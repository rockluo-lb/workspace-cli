import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerVerifyCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('verify')
		.argument('<jiraKey>')
		.description('Run task-level verification commands')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.verifyTask(jiraKey);
			printValue('Verify Task', result);
		});
}
