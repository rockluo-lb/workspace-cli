import type { CodeReview, CommandResult, PlanReview, PlanStep } from '../shared/types.js';

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
- Forced: ${review.forcedApproval ? 'yes' : 'no'}

## Open Questions
${questions}

## Signals
${review.signals.map((signal) => `- ${signal}`).join('\n') || '- None'}

## Next
${
	review.forcedApproval
		? '- 已达到审查轮次上限并强制放行。先和用户确认仍开放的问题，再执行。'
		: review.approved
			? '- 不确定因子已足够低，可进入执行阶段 (`vibe done <JIRA_KEY> --step 1`)。'
			: '- 请携带上述未决问题询问用户，补充信息后重新运行 `vibe plan` 完善计划，再次 `vibe review`。'
}
`;
}

const FINDING_LABELS: Record<string, string> = {
	'over-engineering': '过度设计',
	convention: '项目规范',
	complexity: '复杂度',
	dependency: '依赖',
	scope: '范围',
};

export function renderCodeReviewReport(review: CodeReview): string {
	const findings =
		review.findings.length > 0
			? review.findings
					.map((finding) => {
						const label = FINDING_LABELS[finding.category] ?? finding.category;
						const file = finding.file ? ` \`${finding.file}\`` : '';
						return `- [${label}]${file} ${finding.message}`;
					})
					.join('\n')
			: '- 无问题';

	return `# Code Review for ${review.jiraKey} Step ${review.stepId}

## Verdict
- Iteration: ${review.iteration}
- Risk score: ${review.riskScore} (threshold ${review.threshold})
- Passed: ${review.passed ? 'yes' : 'no'}

## Findings
${findings}

## Signals
${review.signals.map((signal) => `- ${signal}`).join('\n') || '- None'}

## Next
${
	review.passed
		? '- 风险足够低，可以提交该步骤 (`vibe commit <JIRA_KEY> --step N`)。'
		: '- 请先按上述发现精简/修正代码（优先消除过度设计），再重新运行 `vibe code-review <JIRA_KEY> --step N`。'
}
`;
}
