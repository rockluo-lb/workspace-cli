import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerCodeReviewCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('code-review')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.description('Review the current diff of a step and score its risk before committing')
		.action(async (jiraKey: string, options: { step: number }) => {
			const app = await getApp();
			const result = await app.orchestrator.reviewCode(jiraKey, options.step);
			printValue(`Code Review Step ${options.step}`, result);
		});
}
