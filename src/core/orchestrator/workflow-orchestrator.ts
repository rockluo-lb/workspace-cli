import { renderContextMarkdown } from "../templates/context-template.js";
import { renderPlanMarkdown } from "../templates/plan-template.js";
import { renderStepReport, renderVerifyReport } from "../templates/report-template.js";
import { AppError } from "../shared/errors.js";
import {
  CommandResult,
  CommitStepResult,
  ContextResult,
  ExecuteStepResult,
  ExecutionPlan,
  ExternalLink,
  JiraIssueContext,
  PlanResult,
  PlanStep,
  PRResult,
  ProgressState,
  RepoContext,
  ResumeResult,
  StartTaskResult,
  TaskStatus,
  VerifyResult,
  WorkflowOrchestrator,
  WorkflowOrchestratorDeps,
} from "../shared/types.js";
import { assertStepTransition, assertTaskTransition } from "../state/state-machine.js";
import { assertValidCommitMessage, assertValidJiraKey, renderBranchName } from "../shared/validation.js";

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

function nextStatusForExecution(result: ExecuteStepResult): PlanStep["status"] {
  if (result.verifyResults && result.verifyResults.length > 0 && result.verifyResults.every((item) => item.code === 0)) {
    return "verified";
  }
  return "coded";
}

function requireValue<T>(value: T | null, code: AppError["code"], message: string): T {
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
    type: url.includes("figma.com") ? "figma" : url.includes("confluence") ? "confluence" : "other",
    url,
    source: "comment",
    title: url,
  }));
}

export class DefaultWorkflowOrchestrator implements WorkflowOrchestrator {
  constructor(private readonly deps: WorkflowOrchestratorDeps) {}

  async startTask(jiraKey: string): Promise<StartTaskResult> {
    assertValidJiraKey(jiraKey);
    await this.deps.gitService.ensureCleanWorktree();

    const issue = await this.deps.tools.jira.getIssue(jiraKey);
    const directLinks = await this.deps.tools.jira.getIssueLinks(jiraKey);
    const comments = await this.deps.tools.jira.getIssueComments(jiraKey);
    const commentLinks = comments.flatMap((comment) => commentBodyLinks(comment.body));
    const links = mergeLinks(issue, directLinks, commentLinks);
    const warnings: string[] = [];

    for (const link of links.filter((item) => item.type === "figma")) {
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

    await this.deps.gitService.checkoutBaseBranch(this.deps.config.baseBranch);
    await this.deps.gitService.pullBaseBranch(this.deps.config.baseBranch);
    const branch = renderBranchName(jiraKey, this.deps.config.branchPattern);
    await this.deps.gitService.createBranch(branch);

    await this.deps.taskStore.saveIssue(jiraKey, issue);
    await this.deps.taskStore.saveLinks(jiraKey, links);
    const progress: ProgressState = {
      jiraKey,
      branch,
      completedSteps: [],
      commits: [],
      status: "initialized",
    };
    await this.deps.taskStore.saveProgress(jiraKey, progress);
    await this.deps.taskStore.appendLog(jiraKey, "start.log", `Initialized ${jiraKey} on ${branch}`);

    return {
      jiraKey,
      branch,
      taskDir: `.vibe/tasks/${jiraKey}`,
      warnings,
    };
  }

  async buildContext(jiraKey: string): Promise<ContextResult> {
    const issue = requireValue(await this.deps.taskStore.loadIssue(jiraKey), "JIRA_FETCH_FAILED", `Issue not found for ${jiraKey}`);
    const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const confluencePages = [];
    const figmaContexts = [];
    const warnings: string[] = [];

    for (const link of links) {
      if (link.type === "confluence") {
        const page = await this.deps.tools.jira.resolveConfluence(link.url);
        if (page) {
          confluencePages.push(page);
        }
      }
      if (link.type === "figma") {
        try {
          const ref = await this.deps.tools.figma.parseUrl(link.url);
          const context = await this.deps.tools.figma.resolveContext(ref);
          figmaContexts.push(context);
          if (context.partial) {
            warnings.push(`Figma context is partial for ${link.url}`);
          }
        } catch (error) {
          warnings.push(`Unable to resolve Figma context: ${link.url} (${error instanceof Error ? error.message : String(error)})`);
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
    const reportPath = await this.deps.taskStore.writeReport(jiraKey, "context.md", content);
    const nextProgress =
      progress.status === "initialized" || progress.status === "failed"
        ? updateTaskStatus(progress, "context_ready")
        : progress;
    await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
    await this.deps.taskStore.appendLog(jiraKey, "context.log", `Built context for ${jiraKey}`);

    return {
      jiraKey,
      reportPath,
      repoContext,
      warnings,
    };
  }

  async generatePlan(jiraKey: string): Promise<PlanResult> {
    const issue = requireValue(await this.deps.taskStore.loadIssue(jiraKey), "JIRA_FETCH_FAILED", `Issue not found for ${jiraKey}`);
    const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
    let repoContext = await this.deps.taskStore.loadRepoContext(jiraKey);
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);

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
    const reportPath = await this.deps.taskStore.writeTaskFile(jiraKey, "plan.md", renderPlanMarkdown(plan));
    const nextProgress = updateTaskStatus(progress.status === "initialized" ? { ...progress, status: "context_ready" } : progress, "planned");
    await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
    await this.deps.taskStore.appendLog(jiraKey, "plan.log", `Generated plan with ${plan.steps.length} steps`);

    return {
      jiraKey,
      plan,
      reportPath,
    };
  }

  async executeStep(jiraKey: string, stepId: number, options?: { dryRun?: boolean }): Promise<ExecuteStepResult> {
    const plan = requireValue(await this.deps.taskStore.loadPlan(jiraKey), "PLAN_NOT_FOUND", `Plan not found for ${jiraKey}`);
    const repoContext = requireValue(await this.deps.taskStore.loadRepoContext(jiraKey), "STATE_CORRUPTED", `Repo context not found for ${jiraKey}`);
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const step = plan.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new AppError("STEP_NOT_FOUND", `Step ${stepId} not found for ${jiraKey}`);
    }
    if (step.status === "committed") {
      throw new AppError("STEP_ALREADY_COMMITTED", `Step ${stepId} is already committed.`);
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
      renderStepReport(step, [result.summary, ...result.warnings], result.verifyResults),
    );
    const nextProgress = updateTaskStatus(progress.status === "planned" ? progress : { ...progress, status: "planned" }, "coding");
    nextProgress.currentStep = stepId;
    await this.deps.taskStore.saveProgress(jiraKey, nextProgress);
    await this.deps.taskStore.appendLog(jiraKey, `step-${stepId}.log`, `Executed step ${stepId} (${options?.dryRun ? "dry-run" : "report"})`);

    return result;
  }

  async commitStep(jiraKey: string, stepId: number): Promise<CommitStepResult> {
    const plan = requireValue(await this.deps.taskStore.loadPlan(jiraKey), "PLAN_NOT_FOUND", `Plan not found for ${jiraKey}`);
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const step = plan.steps.find((item) => item.id === stepId);
    if (!step) {
      throw new AppError("STEP_NOT_FOUND", `Step ${stepId} not found for ${jiraKey}`);
    }
    if (step.status === "committed") {
      throw new AppError("STEP_ALREADY_COMMITTED", `Step ${stepId} is already committed.`);
    }

    assertValidCommitMessage(step.commitMessage);
    const changedFiles = await this.deps.gitService.getDiffFiles();
    if (changedFiles.length === 0) {
      throw new AppError("DIFF_OUT_OF_SCOPE", `No diff found for step ${stepId}.`);
    }

    const guard = this.deps.diffGuard.validate(step, changedFiles);
    if (!guard.ok) {
      throw new AppError("DIFF_OUT_OF_SCOPE", guard.errors.join("; "));
    }

    await this.deps.gitService.addFiles(changedFiles);
    const sha = await this.deps.gitService.commit(step.commitMessage);
    assertStepTransition(step.status, "committed");
    step.status = "committed";
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
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const verifying = updateTaskStatus(progress.status === "planned" ? { ...progress, status: "coding" } : progress, "verifying");
    await this.deps.taskStore.saveProgress(jiraKey, verifying);

    const results = await this.deps.verifyService.run(this.deps.config.verify.taskCommands);
    const reportPath = await this.deps.taskStore.writeReport(jiraKey, "verify-report.md", renderVerifyReport(results));
    const hasFailure = results.some((result) => result.code !== 0);

    if (hasFailure) {
      verifying.status = "failed";
      verifying.lastError = "Task verification failed.";
      await this.deps.taskStore.saveProgress(jiraKey, verifying);
      throw new AppError("VERIFY_FAILED", "Task verification failed.");
    }

    const ready = updateTaskStatus(verifying, "pr_ready");
    await this.deps.taskStore.saveProgress(jiraKey, ready);
    await this.deps.taskStore.appendLog(jiraKey, "verify.log", `Task verification passed for ${jiraKey}`);
    return {
      jiraKey,
      reportPath,
      results,
    };
  }

  async preparePR(jiraKey: string): Promise<PRResult> {
    const issue = requireValue(await this.deps.taskStore.loadIssue(jiraKey), "JIRA_FETCH_FAILED", `Issue not found for ${jiraKey}`);
    const links = (await this.deps.taskStore.loadLinks(jiraKey)) ?? [];
    const plan = requireValue(await this.deps.taskStore.loadPlan(jiraKey), "PLAN_NOT_FOUND", `Plan not found for ${jiraKey}`);
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const prContext = this.deps.config.github.repository
      ? await this.deps.tools.github.preparePRContext(this.deps.config.github.repository, progress.branch)
      : undefined;
    const content = await this.deps.prBuilder.build({
      issue,
      links,
      plan,
      progress,
      prContext,
    });
    const reportPath = await this.deps.taskStore.writeReport(jiraKey, "pr.md", content);
    await this.deps.taskStore.appendLog(jiraKey, "pr.log", `Generated PR draft for ${jiraKey}`);
    return {
      jiraKey,
      reportPath,
      content,
    };
  }

  async resumeTask(jiraKey: string): Promise<ResumeResult> {
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const plan = await this.deps.taskStore.loadPlan(jiraKey);
    const pendingSteps = plan?.steps.filter((step) => step.status !== "committed").map((step) => step.id) ?? [];
    const currentStepStatus = plan?.steps.find((step) => step.id === progress.currentStep)?.status;
    const nextAction = (() => {
      switch (progress.status) {
        case "initialized":
          return `vibe context ${jiraKey}`;
        case "context_ready":
          return `vibe plan ${jiraKey}`;
        case "planned":
          return `vibe code ${jiraKey} --step ${pendingSteps[0] ?? 1}`;
        case "coding":
          if (currentStepStatus && currentStepStatus !== "committed" && progress.currentStep) {
            return `vibe commit ${jiraKey} --step ${progress.currentStep}`;
          }
          return pendingSteps.length > 0 ? `vibe code ${jiraKey} --step ${pendingSteps[0]}` : `vibe verify ${jiraKey}`;
        case "verifying":
          return `vibe verify ${jiraKey}`;
        case "pr_ready":
          return `vibe pr ${jiraKey}`;
        case "failed":
          return `Inspect logs under .vibe/tasks/${jiraKey}/logs and rerun the last safe command.`;
        case "aborted":
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
    const progress = requireValue(await this.deps.taskStore.loadProgress(jiraKey), "STATE_CORRUPTED", `Progress not found for ${jiraKey}`);
    const aborted = updateTaskStatus(progress, "aborted");
    await this.deps.taskStore.saveProgress(jiraKey, aborted);
    await this.deps.taskStore.appendLog(jiraKey, "abort.log", `Aborted task ${jiraKey}`);
  }
}
