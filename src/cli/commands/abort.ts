import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerAbortCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('abort')
		.argument('<jiraKey>')
		.description('Abort a task without deleting state')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			await app.orchestrator.abortTask(jiraKey);
			printValue('Abort Task', { jiraKey, status: 'aborted' });
		});
}
