import { describe, expect, it } from 'vitest';
import { HeuristicPlanReviewer } from '../../src/core/planning/plan-reviewer.js';
import { defaultConfig } from '../../src/core/shared/config.js';
import type { ExecutionPlan, JiraIssueContext, PlanReviewInput, RepoContext } from '../../src/core/shared/types.js';

function makeInput(overrides: {
	plan?: Partial<ExecutionPlan>;
	issue?: Partial<JiraIssueContext>;
	repoContext?: Partial<RepoContext>;
	iteration?: number;
}): PlanReviewInput {
	const issue: JiraIssueContext = {
		key: 'CRMCN-1234',
		summary: 'Implement reporting endpoint',
		acceptanceCriteria: ['Given data, when requested, then rendered'],
		labels: [],
		links: [],
		...overrides.issue,
	};
	const repoContext: RepoContext = {
		repoName: 'demo',
		packageManager: 'pnpm',
		workspaceType: 'single',
		apps: [],
		packages: [],
		routes: [],
		testTools: [],
		partial: false,
		...overrides.repoContext,
	};
	const plan: ExecutionPlan = {
		jiraKey: 'CRMCN-1234',
		branch: 'feat/CRMCN-1234',
		summary: 'plan',
		assumptions: [],
		risks: [],
		steps: [
			{
				id: 1,
				title: 'Add types',
				description: 'Add API types',
				expectedFiles: ['src/api/types.ts'],
				verifyCommands: ['pnpm lint'],
				commitMessage: 'feat(CRMCN-1234): add types',
				status: 'pending',
			},
		],
		...overrides.plan,
	};
	return {
		jiraKey: 'CRMCN-1234',
		issue,
		links: [],
		repoContext,
		plan,
		config: defaultConfig,
		iteration: overrides.iteration ?? 1,
	};
}

describe('HeuristicPlanReviewer', () => {
	const reviewer = new HeuristicPlanReviewer();

	it('approves a well-scoped plan with low uncertainty', () => {
		const review = reviewer.review(makeInput({}));
		expect(review.uncertaintyScore).toBeLessThanOrEqual(defaultConfig.review.uncertaintyThreshold);
		expect(review.approved).toBe(true);
		expect(review.openQuestions).toHaveLength(0);
	});

	it('raises open questions and blocks approval for an uncertain plan', () => {
		const review = reviewer.review(
			makeInput({
				plan: {
					risks: ['Data model is unclear'],
					steps: [
						{
							id: 1,
							title: 'TBD investigation',
							description: '待确认的实现方式',
							expectedFiles: [],
							verifyCommands: [],
							commitMessage: 'feat(CRMCN-1234): tbd',
							status: 'pending',
						},
					],
				},
				repoContext: { partial: true },
				issue: { acceptanceCriteria: [] },
			})
		);
		expect(review.approved).toBe(false);
		expect(review.uncertaintyScore).toBeGreaterThan(defaultConfig.review.uncertaintyThreshold);
		expect(review.openQuestions.length).toBeGreaterThan(0);
		expect(review.openQuestions.some((question) => question.category === 'context')).toBe(true);
		expect(review.openQuestions.some((question) => question.category === 'scope')).toBe(true);
	});

	it('force-approves when max iterations are reached', () => {
		const review = reviewer.review(
			makeInput({
				plan: { risks: ['A', 'B', 'C', 'D'] },
				iteration: defaultConfig.review.maxIterations,
			})
		);
		expect(review.approved).toBe(true);
		expect(review.signals.some((signal) => signal.includes('forcing approval'))).toBe(true);
	});
});
