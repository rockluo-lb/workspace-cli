import type {
	AIPlanInput,
	AIProvider,
	AIStepExecutionInput,
	ExecutionPlanDraft,
	StepExecutionDraft,
} from '../shared/types.js';

function titleToSlug(title: string): string {
	return (
		title
			.toLowerCase()
			.replace(/[^a-z0-9]+/g, '-')
			.replace(/^-+|-+$/g, '')
			.slice(0, 40) || 'step'
	);
}

export class MockAIProvider implements AIProvider {
	async generatePlan(input: AIPlanInput): Promise<ExecutionPlanDraft> {
		const summary = `Implement ${input.issue.summary} through a tracked step-by-step workflow.`;
		const baseFiles = input.repoContext.partial
			? ['README.md', 'src/index.ts']
			: input.repoContext.routes.slice(0, 2).map((route) => route.file);
		const candidateFiles = baseFiles.length > 0 ? baseFiles : ['src/index.ts'];

		return {
			summary,
			assumptions: [
				'Reuse current repository patterns where possible.',
				'Keep each step independently verifiable and commit-ready.',
			],
			risks: ['Provider data may be partial when external bridges are unavailable.'],
			steps: [
				{
					title: 'Establish task scaffolding',
					description: 'Prepare the workflow state, config, and foundational wiring for this Jira task.',
					expectedFiles: candidateFiles.slice(0, 2),
				},
				{
					title: 'Implement core task behavior',
					description:
						'Add the main behavior for the task while keeping the change set scoped to the active step.',
					expectedFiles: candidateFiles.slice(0, 2),
				},
				{
					title: 'Add verification and PR prep',
					description: 'Finalize verification coverage and generate the artifacts needed for review.',
					expectedFiles: candidateFiles.slice(0, 2),
				},
			],
		};
	}

	async prepareStepExecution(input: AIStepExecutionInput): Promise<StepExecutionDraft> {
		const fileTargets =
			input.step.expectedFiles.length > 0 ? input.step.expectedFiles : ['No expected files declared'];
		return {
			summary: `${input.dryRun ? 'Planned' : 'Prepared'} execution for step ${input.step.id}: ${input.step.title}`,
			warnings: input.repoContext.partial ? ['Repository context is partial.'] : [],
			verifyCommands: input.step.verifyCommands,
			reportSections: [
				`Focus on: ${input.step.description}`,
				`Expected files: ${fileTargets.join(', ')}`,
				`Execution mode: ${input.dryRun ? 'dry-run' : 'report-only MVP mode'}`,
				...input.fileSummaries.slice(0, 3).map((file) => `File context ${file.path}: ${file.excerpt}`),
			],
		};
	}

	suggestCommitMessage(title: string): string {
		return titleToSlug(title).replace(/-/g, ' ');
	}
}
