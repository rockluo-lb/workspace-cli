import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerDoneCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('done')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.option('--dry-run', 'Do not apply source changes')
		.description('Execute a plan step and commit in one atomic operation')
		.action(async (jiraKey: string, options: { step: number; dryRun?: boolean }) => {
			const app = await getApp();
			const codeResult = await app.orchestrator.executeStep(jiraKey, options.step, {
				dryRun: options.dryRun,
			});
			printValue(`Execute Step ${options.step}`, codeResult);

			const commitResult = await app.orchestrator.commitStep(jiraKey, options.step);
			printValue(`Commit Step ${options.step}`, commitResult);
		});
}