import { describe, expect, it } from 'vitest';
import { HeuristicCodeReviewer } from '../../src/core/planning/code-reviewer.js';
import { defaultConfig } from '../../src/core/shared/config.js';
import type {
	CodeReviewInput,
	DiffGuardResult,
	DiffStat,
	PlanStep,
	RepoContext,
} from '../../src/core/shared/types.js';

function makeInput(overrides: {
	step?: Partial<PlanStep>;
	changedFiles?: string[];
	diffStats?: DiffStat[];
	repoContext?: Partial<RepoContext>;
	scopeResult?: Partial<DiffGuardResult>;
	iteration?: number;
}): CodeReviewInput {
	const step: PlanStep = {
		id: 1,
		title: 'Add reporting types',
		description: 'Add API types for the reporting endpoint',
		expectedFiles: ['src/api/reporting.ts'],
		verifyCommands: ['pnpm lint'],
		commitMessage: 'feat(CRMCN-1234): add reporting types',
		status: 'coded',
		...overrides.step,
	};
	const repoContext: RepoContext = {
		repoName: 'demo',
		packageManager: 'pnpm',
		workspaceType: 'single',
		apps: [],
		packages: [],
		routes: [],
		testTools: ['vitest'],
		conventions: {
			cursorRules: [],
			hasAgentsMd: false,
			lintTools: ['eslint'],
			tsStrict: true,
			scripts: ['lint', 'typecheck', 'test'],
			dependencies: ['zod'],
		},
		...overrides.repoContext,
	};

	return {
		jiraKey: 'CRMCN-1234',
		step,
		changedFiles: overrides.changedFiles ?? ['src/api/reporting.ts'],
		diffStats: overrides.diffStats ?? [{ file: 'src/api/reporting.ts', insertions: 20, deletions: 4 }],
		repoContext,
		scopeResult: { ok: true, warnings: [], errors: [], ...overrides.scopeResult },
		config: defaultConfig,
		iteration: overrides.iteration ?? 1,
	};
}

describe('HeuristicCodeReviewer', () => {
	const reviewer = new HeuristicCodeReviewer();

	it('passes a small, scoped, convention-compliant diff', () => {
		const review = reviewer.review(makeInput({}));
		expect(review.riskScore).toBeLessThanOrEqual(defaultConfig.codeReview.riskThreshold);
		expect(review.passed).toBe(true);
		expect(review.findings).toHaveLength(0);
	});

	it('flags over-engineering when many new files and abstraction layers are added', () => {
		const review = reviewer.review(
			makeInput({
				changedFiles: [
					'src/api/reporting.ts',
					'src/api/reporting-factory.ts',
					'src/api/reporting-manager.ts',
					'src/api/reporting-wrapper.ts',
					'src/api/abstract.ts',
				],
				diffStats: [
					{ file: 'src/api/reporting.ts', insertions: 30, deletions: 0 },
					{ file: 'src/api/reporting-factory.ts', insertions: 40, deletions: 0 },
					{ file: 'src/api/reporting-manager.ts', insertions: 40, deletions: 0 },
					{ file: 'src/api/reporting-wrapper.ts', insertions: 40, deletions: 0 },
					{ file: 'src/api/abstract.ts', insertions: 40, deletions: 0 },
				],
			})
		);

		expect(review.passed).toBe(false);
		expect(review.riskScore).toBeGreaterThan(defaultConfig.codeReview.riskThreshold);
		expect(review.findings.some((finding) => finding.category === 'over-engineering')).toBe(true);
	});

	it('flags scope violations, dependency changes, and convention gaps', () => {
		const review = reviewer.review(
			makeInput({
				step: { verifyCommands: ['echo skip'] },
				changedFiles: ['src/api/reporting.ts', 'package.json', 'src/unrelated/thing.ts'],
				diffStats: [
					{ file: 'src/api/reporting.ts', insertions: 10, deletions: 2 },
					{ file: 'package.json', insertions: 2, deletions: 0 },
					{ file: 'src/unrelated/thing.ts', insertions: 5, deletions: 0 },
				],
				scopeResult: {
					ok: false,
					errors: ['File out of scope for step 1: src/unrelated/thing.ts'],
					warnings: [],
				},
			})
		);

		expect(review.passed).toBe(false);
		expect(review.findings.some((finding) => finding.category === 'scope')).toBe(true);
		expect(review.findings.some((finding) => finding.category === 'dependency')).toBe(true);
		expect(review.findings.some((finding) => finding.category === 'convention')).toBe(true);
	});

	it('flags complexity when the diff is too large and misses tests', () => {
		const review = reviewer.review(
			makeInput({
				diffStats: [
					{ file: 'src/api/reporting.ts', insertions: defaultConfig.codeReview.maxInsertions + 50, deletions: 0 },
				],
			})
		);

		expect(review.passed).toBe(false);
		expect(review.findings.some((finding) => finding.category === 'complexity')).toBe(true);
		expect(review.findings.some((finding) => finding.message.includes('未改动任何测试'))).toBe(true);
	});

	it('force-passes when max iterations are reached', () => {
		const review = reviewer.review(
			makeInput({
				scopeResult: { ok: false, errors: ['File out of scope for step 1: src/other.ts'], warnings: [] },
				iteration: defaultConfig.codeReview.maxIterations,
			})
		);

		expect(review.passed).toBe(true);
		expect(review.signals.some((signal) => signal.includes('forcing pass'))).toBe(true);
	});
});
