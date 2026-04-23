import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerCodeCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('code')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.option('--dry-run', 'Do not apply source changes')
		.description('Execute a single plan step')
		.action(async (jiraKey: string, options: { step: number; dryRun?: boolean }) => {
			const app = await getApp();
			const result = await app.orchestrator.executeStep(jiraKey, options.step, {
				dryRun: options.dryRun,
			});
			printValue(`Execute Step ${options.step}`, result);
		});
}
