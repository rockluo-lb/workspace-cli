import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerPrCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('pr')
		.argument('<jiraKey>')
		.description('Generate a PR draft report')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.preparePR(jiraKey);
			printValue('Prepare PR', result);
		});
}
