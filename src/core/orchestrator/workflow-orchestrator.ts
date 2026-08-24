import path from 'node:path';
import { AppError } from '../shared/errors.js';
import type {
	CodeReviewResult,
	CommitStepResult,
	ContextResult,
	ExecuteStepResult,
	ExternalLink,
	JiraIssueContext,
	PlanResult,
	PlanStep,
	ProgressState,
	PRResult,
	ResumeResult,
	ReviewResult,
	StartTaskResult,
	TaskStatus,
	VerifyResult,
	WorkflowOrchestrator,
	WorkflowOrchestratorDeps,
} from '../shared/types.js';
import { assertValidCommitMessage, assertValidJiraKey, renderBranchName } from '../shared/validation.js';
import { assertStepTransition, assertTaskTransition } from '../state/state-machine.js';
import { renderContextMarkdown } from '../templates/context-template.js';
import { renderPlanMarkdown } from '../templates/plan-template.js';
import {
	renderCodeReviewReport,
	renderReviewReport,
	renderStepReport,
	renderVerifyReport,
} from '../templates/report-template.js';

function mergeLinks(issue: JiraIssueContext, links: ExternalLink[], commentLinks: ExternalLink[]): ExternalLink[] {
	const seen = new Set<string>();
	const merged = [...issue.links, ...links, ...commentLinks].filter((link) => {
		if (seen.has(link.url)) {
			return false;
		}
		seen.add(link.url);
		return true;
	});
	issue.links = merged;
	return merged;
}

function nextStatusForExecution(result: ExecuteStepResult): PlanStep['status'] {
	if (
		result.verifyResults &&
		result.verifyResults.length > 0 &&
		result.verifyResults.every((item) => item.code === 0)
	) {
		return 'verified';
	}
	return 'coded';
}

function requireValue<T>(value: T | null, code: AppError['code'], message: string): T {
	if (value === null) {
		throw new AppError(code, message);
	}
	return value;
}

function updateTaskStatus(progress: ProgressState, next: TaskStatus): ProgressState {
	if (progress.status !== next) {
		assertTaskTransition(progress.status, next);
	}
	return {
		...progress,
		status: next,
	};
}

function commentBodyLinks(body: string): ExternalLink[] {
	const urls = body.match(/https?:\/\/[^\s)]+/g) ?? [];
	return urls.map((url) => ({
		type: url.includes('figma.com') ? 'figma' : url.includes('confluence') ? 'confluence' : 'other',
		url,
		source: 'comment',
		title: url,
	}));
}

export class DefaultWorkflowOrchestrator implements WorkflowOrchestrator {
	constructor(private readonly deps: WorkflowOrchestratorDeps) {}

	async startTask(jiraKey: string): Promise<StartTaskResult> {
		assertValidJiraKey(jiraKey);
		await this.deps.gitService.ensureCleanWorktree();
		const initialBranch = await this.deps.gitService.getCurrentBranch();
		const fallbackBaseBranch = this.deps.config.baseBranch;
		const baseBranch = initialBranch || fallbackBaseBranch;

		const issue = await this.deps.tools.jira.getIssue(jiraKey);
		const directLinks = await this.deps.tools.jira.getIssueLinks(jiraKey);
		const comments = await this.deps.tools.jira.getIssueComments(jiraKey);
		const commentLinks = comments.flatMap((comment) => commentBodyLinks(comment.body));
		const links = mergeLinks(issue, directLinks, commentLinks);
		const warnings: string[] = [];

		for (const link of links.filter((item) => item.type === 'figma')) {
			try {
				const parsed = await this.deps.tools.figma.parseUrl(link.url);
				link.metadata = {
					...(link.metadata ?? {}),
					...(parsed.fileId ? { fileId: parsed.fileId } : {}),
					...(parsed.nodeId ? { nodeId: parsed.nodeId } : {}),
					...(parsed.mode ? { mode: parsed.mode } : {}),
				};
			} catch {
				warnings.push(`Failed to parse Figma link: ${link.url}`);
			}
		}

		if (!initialBranch) {
			await this.deps.gitService.checkoutBaseBranch(baseBranch);
			await this.deps.gitService.pullBaseBranch(baseBranch);
		}
		const branch = renderBranchName(jiraKey, this.deps.config.branchPattern);
		await this.deps.gitService.createBranch(branch);
		const currentBranch = await this.deps.gitService.getCurrentBranch();

		await this.deps.taskStore.saveIssue(jiraKey, issue);
		await this.deps.taskStore.saveLinks(jiraKey, links);
		const progress: ProgressState = {
			jiraKey,
			branch,
			completedSteps: [],
			commits: [],
			status: 'initialized',
		};
		await this.deps.taskStore.saveProgress(jiraKey, progress);
		await this.deps.taskStore.appendLog(
			jiraKey,
			'start.log',
			`Initialized ${jiraKey} from ${initialBranch} via ${baseBranch} onto ${currentBranch}`
		);

		return {
			jiraKey,
			initialBranch,
			baseBranch,
			branch,
			currentBranch,
			taskDir: path.join(this.deps.stateRoot, 'tasks', jiraKey),
			warnings,
		};
	}

	async buildContext(jiraKey: string): Promise<ContextResult> {
		const issue = requireValue(
			await this.deps.taskStore.loadIssue(jiraKey),
			'JIRA_FETCH_FAILED',
			`Issue not found for ${jiraKey}`
		);
		const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const confluencePages = [];
		const figmaContexts = [];
		const warnings: string[] = [];

		for (const link of links) {
			if (link.type === 'confluence') {
				const page = await this.deps.tools.jira.resolveConfluence(link.url);
				if (page) {
					confluencePages.push(page);
				}
			}
			if (link.type === 'figma') {
				try {
					const ref = await this.deps.tools.figma.parseUrl(link.url);
					const context = await this.deps.tools.figma.resolveContext(ref);
					figmaContexts.push(context);
					if (context.partial) {
						warnings.push(`Figma context is partial for ${link.url}`);
					}
				} catch (error) {
					warnings.push(
						`Unable to resolve Figma context: ${link.url} (${error instanceof Error ? error.message : String(error)})`
					);
				}
			}
		}

		const githubContext = this.deps.config.github.repository
			? await this.deps.tools.github.getRepositoryMeta(this.deps.config.github.repository)
			: undefined;
		const repoContext = await this.deps.repoAnalyzer.analyze({
			localRepoPath: this.deps.rootDir,
			repositoryFullName: this.deps.config.github.repository,
			githubContext,
		});

		await this.deps.taskStore.saveRepoContext(jiraKey, repoContext);
		const content = renderContextMarkdown({
			issue,
			repoContext,
			figmaContexts,
			confluencePages,
		});
		const reportPath = await this.deps.taskStore.writeReport(jiraKey, 'context.md', content);
		const nextProgress =
			progress.status === 'initialized' || progress.status === 'failed'
				? updateTaskStatus(progress, 'context_ready')
				: progress;
		await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
		await this.deps.taskStore.appendLog(jiraKey, 'context.log', `Built context for ${jiraKey}`);

		return {
			jiraKey,
			reportPath,
			repoContext,
			warnings,
		};
	}

	async generatePlan(jiraKey: string): Promise<PlanResult> {
		const issue = requireValue(
			await this.deps.taskStore.loadIssue(jiraKey),
			'JIRA_FETCH_FAILED',
			`Issue not found for ${jiraKey}`
		);
		const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
		let repoContext = await this.deps.taskStore.loadRepoContext(jiraKey);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);

		if (!repoContext) {
			repoContext = (await this.buildContext(jiraKey)).repoContext;
		}

		const plan = await this.deps.planner.generate({
			jiraKey,
			issue,
			links,
			repoContext,
			config: this.deps.config,
		});

		await this.deps.taskStore.savePlan(jiraKey, plan);
		const reportPath = await this.deps.taskStore.writeTaskFile(jiraKey, 'plan.md', renderPlanMarkdown(plan));
		const rebased =
			progress.status === 'initialized' ? { ...progress, status: 'context_ready' as TaskStatus } : progress;
		const nextProgress = updateTaskStatus(rebased, 'planned');
		await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
		await this.deps.taskStore.appendLog(jiraKey, 'plan.log', `Generated plan with ${plan.steps.length} steps`);

		return {
			jiraKey,
			plan,
			reportPath,
		};
	}

	async reviewPlan(jiraKey: string): Promise<ReviewResult> {
		const issue = requireValue(
			await this.deps.taskStore.loadIssue(jiraKey),
			'JIRA_FETCH_FAILED',
			`Issue not found for ${jiraKey}`
		);
		const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
		const plan = requireValue(
			await this.deps.taskStore.loadPlan(jiraKey),
			'PLAN_NOT_FOUND',
			`Plan not found for ${jiraKey}`
		);
		const repoContext = requireValue(
			await this.deps.taskStore.loadRepoContext(jiraKey),
			'STATE_CORRUPTED',
			`Repo context not found for ${jiraKey}`
		);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);

		const iteration = (progress.reviewIteration ?? 0) + 1;
		const review = this.deps.planReviewer.review({
			jiraKey,
			issue,
			links,
			repoContext,
			plan,
			config: this.deps.config,
			iteration,
		});

		const reportPath = await this.deps.taskStore.writeReport(jiraKey, 'review.md', renderReviewReport(review));

		const reviewing = updateTaskStatus(progress, 'reviewing');
		reviewing.reviewIteration = iteration;
		reviewing.lastUncertaintyScore = review.uncertaintyScore;
		await this.deps.taskStore.saveProgress(jiraKey, reviewing);

		const nextAction = review.approved
			? `vibe done ${jiraKey} --step ${plan.steps[0]?.id ?? 1}`
			: `Ask the user the ${review.openQuestions.length} open question(s), then rerun \`vibe plan ${jiraKey}\` and \`vibe review ${jiraKey}\`.`;

		if (review.approved) {
			const approved = updateTaskStatus(reviewing, 'plan_approved');
			await this.deps.taskStore.saveProgress(jiraKey, approved);
		} else {
			const backToPlanned = updateTaskStatus(reviewing, 'planned');
			await this.deps.taskStore.saveProgress(jiraKey, backToPlanned);
		}

		await this.deps.taskStore.appendLog(
			jiraKey,
			'review.log',
			`Reviewed plan (iteration ${iteration}): score=${review.uncertaintyScore}, approved=${review.approved}`
		);

		return {
			jiraKey,
			review,
			reportPath,
			nextAction,
		};
	}

	async executeStep(jiraKey: string, stepId: number, options?: { dryRun?: boolean }): Promise<ExecuteStepResult> {
		const plan = requireValue(
			await this.deps.taskStore.loadPlan(jiraKey),
			'PLAN_NOT_FOUND',
			`Plan not found for ${jiraKey}`
		);
		const repoContext = requireValue(
			await this.deps.taskStore.loadRepoContext(jiraKey),
			'STATE_CORRUPTED',
			`Repo context not found for ${jiraKey}`
		);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const step = plan.steps.find((item) => item.id === stepId);
		if (!step) {
			throw new AppError('STEP_NOT_FOUND', `Step ${stepId} not found for ${jiraKey}`);
		}
		if (step.status === 'committed') {
			throw new AppError('STEP_ALREADY_COMMITTED', `Step ${stepId} is already committed.`);
		}
		if (progress.status === 'planned' || progress.status === 'reviewing') {
			throw new AppError(
				'PLAN_NOT_APPROVED',
				`Plan for ${jiraKey} is not approved yet. Run \`vibe review ${jiraKey}\` and resolve open questions until the uncertainty score is low enough.`
			);
		}

		const result = await this.deps.executor.execute({
			jiraKey,
			step,
			repoContext,
			dryRun: options?.dryRun,
			maxFiles: this.deps.config.planning.maxFilesPerStep,
		});

		const nextStatus = nextStatusForExecution(result);
		assertStepTransition(step.status, nextStatus);
		step.status = nextStatus;

		await this.deps.taskStore.savePlan(jiraKey, plan);
		await this.deps.taskStore.writeReport(
			jiraKey,
			`step-${stepId}-report.md`,
			renderStepReport(step, [result.summary, ...result.warnings], result.verifyResults)
		);
		const coding = progress.status === 'coding' ? progress : updateTaskStatus(progress, 'coding');
		const nextProgress = updateTaskStatus(coding, 'code_review');
		nextProgress.currentStep = stepId;
		nextProgress.codeReviewIteration = 0;
		await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
		await this.deps.taskStore.appendLog(
			jiraKey,
			`step-${stepId}.log`,
			`Executed step ${stepId} (${options?.dryRun ? 'dry-run' : 'report'})`
		);

		return result;
	}

	async reviewCode(jiraKey: string, stepId: number): Promise<CodeReviewResult> {
		const plan = requireValue(
			await this.deps.taskStore.loadPlan(jiraKey),
			'PLAN_NOT_FOUND',
			`Plan not found for ${jiraKey}`
		);
		const repoContext = requireValue(
			await this.deps.taskStore.loadRepoContext(jiraKey),
			'STATE_CORRUPTED',
			`Repo context not found for ${jiraKey}`
		);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const step = plan.steps.find((item) => item.id === stepId);
		if (!step) {
			throw new AppError('STEP_NOT_FOUND', `Step ${stepId} not found for ${jiraKey}`);
		}
		if (step.status === 'committed') {
			throw new AppError('STEP_ALREADY_COMMITTED', `Step ${stepId} is already committed.`);
		}

		const changedFiles = await this.deps.gitService.getDiffFiles();
		const diffStats = await this.deps.gitService.getDiffStat();
		const scopeResult = this.deps.diffGuard.validate(step, changedFiles);
		const iteration = (progress.codeReviewIteration ?? 0) + 1;
		const review = this.deps.codeReviewer.review({
			jiraKey,
			step,
			changedFiles,
			diffStats,
			repoContext,
			scopeResult,
			config: this.deps.config,
			iteration,
		});

		const reportPath = await this.deps.taskStore.writeReport(
			jiraKey,
			`step-${stepId}-code-review.md`,
			renderCodeReviewReport(review)
		);

		const reviewing =
			progress.status === 'code_review' ? progress : updateTaskStatus(progress, 'code_review');
		reviewing.currentStep = stepId;
		reviewing.codeReviewIteration = iteration;
		reviewing.lastRiskScore = review.riskScore;

		if (review.passed) {
			assertStepTransition(step.status, 'reviewed');
			step.status = 'reviewed';
			await this.deps.taskStore.savePlan(jiraKey, plan);
		}

		const nextProgress = updateTaskStatus(reviewing, 'coding');
		await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
		await this.deps.taskStore.appendLog(
			jiraKey,
			`step-${stepId}.log`,
			`Code reviewed step ${stepId} (iteration ${iteration}): score=${review.riskScore}, passed=${review.passed}`
		);

		const nextAction = review.passed
			? `vibe commit ${jiraKey} --step ${stepId}`
			: `Fix the ${review.findings.length} finding(s) in the code review report (remove over-engineering first), then rerun \`vibe code-review ${jiraKey} --step ${stepId}\`.`;

		return {
			jiraKey,
			stepId,
			review,
			reportPath,
			nextAction,
		};
	}

	async commitStep(jiraKey: string, stepId: number): Promise<CommitStepResult> {
		const plan = requireValue(
			await this.deps.taskStore.loadPlan(jiraKey),
			'PLAN_NOT_FOUND',
			`Plan not found for ${jiraKey}`
		);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const step = plan.steps.find((item) => item.id === stepId);
		if (!step) {
			throw new AppError('STEP_NOT_FOUND', `Step ${stepId} not found for ${jiraKey}`);
		}
		if (step.status === 'committed') {
			throw new AppError('STEP_ALREADY_COMMITTED', `Step ${stepId} is already committed.`);
		}
		if (step.status !== 'reviewed') {
			throw new AppError(
				'CODE_REVIEW_NOT_PASSED',
				`Step ${stepId} has not passed code review. Run \`vibe code-review ${jiraKey} --step ${stepId}\` and resolve the findings before committing.`
			);
		}

		assertValidCommitMessage(step.commitMessage);
		const changedFiles = await this.deps.gitService.getDiffFiles();
		if (changedFiles.length === 0) {
			throw new AppError('DIFF_OUT_OF_SCOPE', `No diff found for step ${stepId}.`);
		}

		// Auto-stage all changed files before scope validation
		await this.deps.gitService.addFiles(changedFiles);

		const guard = this.deps.diffGuard.validate(step, changedFiles);
		if (!guard.ok) {
			throw new AppError('DIFF_OUT_OF_SCOPE', guard.errors.join('; '));
		}

		const sha = await this.deps.gitService.commit(step.commitMessage);
		assertStepTransition(step.status, 'committed');
		step.status = 'committed';
		// Auto-update expectedFiles with actual committed files
		step.expectedFiles = [...new Set([...step.expectedFiles, ...changedFiles])].sort();
		await this.deps.taskStore.savePlan(jiraKey, plan);

		progress.completedSteps = [...new Set([...progress.completedSteps, stepId])].sort((a, b) => a - b);
		progress.commits = [...progress.commits, { step: stepId, sha, message: step.commitMessage }];
		progress.currentStep = stepId;
		await this.deps.taskStore.saveProgress(jiraKey, progress);
		await this.deps.taskStore.appendLog(jiraKey, `step-${stepId}.log`, `Committed step ${stepId} as ${sha}`);

		return {
			jiraKey,
			stepId,
			sha,
			message: step.commitMessage,
		};
	}

	async verifyTask(jiraKey: string): Promise<VerifyResult> {
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const verifying = updateTaskStatus(
			progress.status === 'plan_approved' ? { ...progress, status: 'coding' } : progress,
			'verifying'
		);
		await this.deps.taskStore.saveProgress(jiraKey, verifying);

		const results = await this.deps.verifyService.run(this.deps.config.verify.taskCommands);
		const reportPath = await this.deps.taskStore.writeReport(
			jiraKey,
			'verify-report.md',
			renderVerifyReport(results)
		);
		const hasFailure = results.some((result) => result.code !== 0);

		if (hasFailure) {
			verifying.status = 'failed';
			verifying.lastError = 'Task verification failed.';
			await this.deps.taskStore.saveProgress(jiraKey, verifying);
			throw new AppError('VERIFY_FAILED', 'Task verification failed.');
		}

		const ready = updateTaskStatus(verifying, 'pr_ready');
		await this.deps.taskStore.saveProgress(jiraKey, ready);
		await this.deps.taskStore.appendLog(jiraKey, 'verify.log', `Task verification passed for ${jiraKey}`);
		return {
			jiraKey,
			reportPath,
			results,
		};
	}

	async preparePR(jiraKey: string): Promise<PRResult> {
		const issue = requireValue(
			await this.deps.taskStore.loadIssue(jiraKey),
			'JIRA_FETCH_FAILED',
			`Issue not found for ${jiraKey}`
		);
		const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
		const plan = requireValue(
			await this.deps.taskStore.loadPlan(jiraKey),
			'PLAN_NOT_FOUND',
			`Plan not found for ${jiraKey}`
		);
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const prContext = this.deps.config.github.repository
			? await this.deps.tools.github.preparePRContext(this.deps.config.github.repository, progress.branch)
			: undefined;
		const content = await this.deps.prBuilder.build({
			issue,
			links,
			plan,
			progress,
			aiDisclosure: this.deps.config.pr.aiDisclosure,
			reviewers: this.deps.config.github.reviewers ?? [],
			prContext,
		});
		const reportPath = await this.deps.taskStore.writeReport(jiraKey, 'pr.md', content);
		await this.deps.taskStore.appendLog(jiraKey, 'pr.log', `Generated PR draft for ${jiraKey}`);
		return {
			jiraKey,
			reportPath,
			content,
		};
	}

	async resumeTask(jiraKey: string): Promise<ResumeResult> {
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const plan = await this.deps.taskStore.loadPlan(jiraKey);
		const pendingSteps = plan?.steps.filter((step) => step.status !== 'committed').map((step) => step.id) ?? [];
		const currentStepStatus = plan?.steps.find((step) => step.id === progress.currentStep)?.status;
		const nextAction = (() => {
			switch (progress.status) {
				case 'initialized':
					return `vibe context ${jiraKey}`;
				case 'context_ready':
					return `vibe plan ${jiraKey}`;
				case 'planned':
					return `vibe review ${jiraKey}`;
				case 'reviewing':
					return `Resolve the open questions in review.md with the user, then rerun \`vibe plan ${jiraKey}\` and \`vibe review ${jiraKey}\`.`;
				case 'plan_approved':
					return `vibe done ${jiraKey} --step ${pendingSteps[0] ?? 1}`;
				case 'coding':
					if (progress.currentStep && currentStepStatus === 'reviewed') {
						return `vibe commit ${jiraKey} --step ${progress.currentStep}`;
					}
					if (progress.currentStep && currentStepStatus && currentStepStatus !== 'committed') {
						return `vibe code-review ${jiraKey} --step ${progress.currentStep}`;
					}
					return pendingSteps.length > 0
						? `vibe done ${jiraKey} --step ${pendingSteps[0]}`
						: `vibe verify ${jiraKey}`;
				case 'code_review':
					return `vibe code-review ${jiraKey} --step ${progress.currentStep ?? pendingSteps[0] ?? 1}`;
				case 'verifying':
					return `vibe verify ${jiraKey}`;
				case 'pr_ready':
					return `vibe pr ${jiraKey}`;
				case 'failed':
					return `Inspect logs under ${path.join(this.deps.stateRoot, 'tasks', jiraKey, 'logs')} and rerun the last safe command.`;
				case 'aborted':
					return `Task ${jiraKey} is aborted. Re-run vibe start if you want a fresh task.`;
			}
		})();

		return {
			jiraKey,
			status: progress.status,
			nextAction,
			pendingSteps,
		};
	}

	async abortTask(jiraKey: string): Promise<void> {
		const progress = requireValue(
			await this.deps.taskStore.loadProgress(jiraKey),
			'STATE_CORRUPTED',
			`Progress not found for ${jiraKey}`
		);
		const aborted = updateTaskStatus(progress, 'aborted');
		await this.deps.taskStore.saveProgress(jiraKey, aborted);
		await this.deps.taskStore.appendLog(jiraKey, 'abort.log', `Aborted task ${jiraKey}`);
	}
}
