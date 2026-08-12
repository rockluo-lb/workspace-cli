import type { CommandResult, PlanReview, PlanStep } from '../shared/types.js';

export function renderStepReport(step: PlanStep, sections: string[], verifyResults?: CommandResult[]): string {
	const verify =
		verifyResults && verifyResults.length > 0
			? verifyResults
					.map((result) => `- \`${result.command}\`: ${result.code === 0 ? 'pass' : `fail (${result.code})`}`)
					.join('\n')
			: '- Not run';

	return `# Step ${step.id} Report

## Step
- Title: ${step.title}
- Status: ${step.status}
- Commit: \`${step.commitMessage}\`

## Notes
${sections.map((item) => `- ${item}`).join('\n')}

## Verification
${verify}
`;
}

export function renderVerifyReport(results: CommandResult[]): string {
	return `# Task Verification

${results.map((result) => `- \`${result.command}\`: ${result.code === 0 ? 'pass' : `fail (${result.code})`}`).join('\n')}
`;
}

const CATEGORY_LABELS: Record<string, string> = {
	divergence: '差异化 / 不确定',
	scope: '范围',
	design: '设计假设',
	verification: '验证',
	context: '上下文',
};

export function renderReviewReport(review: PlanReview): string {
	const questions =
		review.openQuestions.length > 0
			? review.openQuestions
					.map((question) => {
						const label = CATEGORY_LABELS[question.category] ?? question.category;
						const step = question.relatedStepId ? ` (Step ${question.relatedStepId})` : '';
						return `- [${label}]${step} ${question.prompt}`;
					})
					.join('\n')
			: '- 无未决问题';

	return `# Plan Review for ${review.jiraKey}

## Verdict
- Iteration: ${review.iteration}
- Uncertainty score: ${review.uncertaintyScore} (threshold ${review.threshold})
- Approved: ${review.approved ? 'yes' : 'no'}

## Open Questions
${questions}

## Signals
${review.signals.map((signal) => `- ${signal}`).join('\n') || '- None'}

## Next
${
	review.approved
		? '- 不确定因子已足够低，可进入执行阶段 (`vibe done <JIRA_KEY> --step 1`)。'
		: '- 请携带上述未决问题询问用户，补充信息后重新运行 `vibe plan` 完善计划，再次 `vibe review`。'
}
`;
}
