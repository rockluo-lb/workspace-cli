import { z } from 'zod';
import { AppError } from '../shared/errors.js';
import type { AIPlanInput, AIProvider, ExecutionPlan, ExecutionPlanDraft, PlanStep, VibeConfig } from '../shared/types.js';
import { commitBody, renderBranchName, renderCommitMessage } from '../shared/validation.js';
import { renderPlanMarkdown } from '../templates/plan-template.js';

const planDraftSchema = z.object({
	summary: z.string().optional(),
	assumptions: z.array(z.string()).optional(),
	risks: z.array(z.string()).optional(),
	decisions: z.array(z.object({ question: z.string().min(1), answer: z.string().min(1) })).optional(),
	steps: z
		.array(
			z.object({
				title: z.string().min(1),
				description: z.string().optional(),
				rationale: z.string().optional(),
				expectedFiles: z.array(z.string()).optional(),
				verifyCommands: z.array(z.string()).optional(),
				commitMessage: z.string().optional(),
			})
		)
		.min(1),
});

export function parsePlanDraft(raw: unknown): ExecutionPlanDraft {
	const result = planDraftSchema.safeParse(raw);
	if (!result.success) {
		throw new AppError('PLAN_INVALID', `Plan file is invalid:\n${z.prettifyError(result.error)}`);
	}
	return result.data;
}

function normalizeStep(jiraKey: string, config: VibeConfig, step: Partial<PlanStep>, index: number): PlanStep {
	const title = step.title?.trim() || `Step ${index + 1}`;
	const body = commitBody(step.commitMessage, title.toLowerCase());
	return {
		id: index + 1,
		title,
		description: step.description?.trim() || `Implement ${title}.`,
		rationale: step.rationale,
		expectedFiles: step.expectedFiles ?? [],
		verifyCommands:
			step.verifyCommands && step.verifyCommands.length > 0 ? step.verifyCommands : config.verify.stepCommands,
		commitMessage: renderCommitMessage(jiraKey, body, config.commitPattern),
		status: 'pending',
	};
}

export class DefaultPlanner {
	constructor(
		private readonly aiProvider: AIProvider,
		private readonly config: VibeConfig
	) {}

	async generate(params: AIPlanInput & { jiraKey: string }): Promise<ExecutionPlan> {
		const draft = await this.aiProvider.generatePlan(params);
		const rawSteps = draft.steps.slice(0, this.config.planning.maxSteps).map((step) => ({
			...step,
			expectedFiles: step.expectedFiles?.slice(0, this.config.planning.maxFilesPerStep),
		}));
		while (rawSteps.length < this.config.planning.minSteps) {
			rawSteps.push({
				title: `Additional step ${rawSteps.length + 1}`,
				description: 'Fill the remaining scoped work for this task.',
				expectedFiles: [],
			});
		}

		return this.fromDraft(params.jiraKey, params.issue.summary, { ...draft, steps: rawSteps });
	}

	fromDraft(jiraKey: string, issueSummary: string, draft: ExecutionPlanDraft): ExecutionPlan {
		return {
			jiraKey,
			branch: renderBranchName(jiraKey, this.config.branchPattern),
			summary: draft.summary ?? `Execution plan for ${issueSummary}`,
			assumptions: draft.assumptions ?? [],
			risks: draft.risks ?? [],
			decisions: draft.decisions ?? [],
			steps: draft.steps.map((step, index) => normalizeStep(jiraKey, this.config, step, index)),
		};
	}

	render(plan: ExecutionPlan): string {
		return renderPlanMarkdown(plan);
	}
}
