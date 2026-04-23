import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../../src/core/planning/mock-ai-provider.js';
import { DefaultPlanner } from '../../src/core/planning/planner.js';
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
});
