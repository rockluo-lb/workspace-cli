import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerAdoptCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('adopt')
		.argument('<jiraKey>')
		.description('Rebuild task state from the current feature branch')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.adoptTask(jiraKey);
			printValue('Adopt Task', result);
		});
}
