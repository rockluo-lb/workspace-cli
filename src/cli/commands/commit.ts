import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerCommitCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('commit')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.description('Commit the current diff for a step')
		.action(async (jiraKey: string, options: { step: number }) => {
			const app = await getApp();
			const result = await app.orchestrator.commitStep(jiraKey, options.step);
			printValue(`Commit Step ${options.step}`, result);
		});
}
