import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../../src/core/planning/mock-ai-provider.js';
import { DefaultPlanner, parsePlanDraft } from '../../src/core/planning/planner.js';
import { defaultConfig } from '../../src/core/shared/config.js';

describe('planner', () => {
	it('normalizes steps into a constrained plan', async () => {
		const planner = new DefaultPlanner(new MockAIProvider(), defaultConfig);
		const plan = await planner.generate({
			jiraKey: 'CRMCN-1234',
			issue: {
				key: 'CRMCN-1234',
				summary: 'Implement reporting dashboard',
				acceptanceCriteria: [],
				labels: [],
				links: [],
			},
			links: [],
			repoContext: {
				repoName: 'demo',
				packageManager: 'pnpm',
				workspaceType: 'single',
				apps: [],
				packages: [],
				routes: [],
				testTools: [],
				partial: true,
			},
			config: defaultConfig,
		});

		expect(plan.steps.length).toBeGreaterThanOrEqual(3);
		expect(plan.steps.length).toBeLessThanOrEqual(7);
		for (const step of plan.steps) {
			expect(step.verifyCommands.length).toBeGreaterThan(0);
			expect(step.commitMessage.startsWith('feat(CRMCN-1234):')).toBe(true);
		}
	});

	it('builds an imported plan as written', () => {
		const planner = new DefaultPlanner(new MockAIProvider(), defaultConfig);
		const draft = parsePlanDraft({
			summary: 'Imported plan',
			decisions: [{ question: 'Which portal first?', answer: 'TMGM' }],
			steps: [
				{
					title: 'Document the flow',
					expectedFiles: ['docs/flow.md'],
					commitMessage: 'feat(CRMCN-1234): document the flow',
				},
			],
		});
		const plan = planner.fromDraft('CRMCN-1234', 'Reporting', draft);

		expect(plan.steps).toHaveLength(1);
		expect(plan.steps[0]).toMatchObject({
			id: 1,
			expectedFiles: ['docs/flow.md'],
			verifyCommands: defaultConfig.verify.stepCommands,
			commitMessage: 'feat(CRMCN-1234): document the flow',
			status: 'pending',
		});
		expect(plan.decisions).toEqual([{ question: 'Which portal first?', answer: 'TMGM' }]);
	});

	it('rejects a plan file without steps', () => {
		expect(() => parsePlanDraft({ summary: 'empty', steps: [] })).toThrow(
			expect.objectContaining({ code: 'PLAN_INVALID' })
		);
	});
});
