import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerReviewCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('review')
		.argument('<jiraKey>')
		.description('Review the plan and score its uncertainty before execution')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.reviewPlan(jiraKey);
			printValue('Review Plan', result);
		});
}
