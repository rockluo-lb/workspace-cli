import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerStartCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('start')
		.argument('<jiraKey>')
		.description('Initialize a Jira-driven task workflow')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.startTask(jiraKey);
			printValue('Start Task', result);
		});
}
