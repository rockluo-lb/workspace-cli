import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerStartCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('start')
		.argument('<jiraKey>')
		.option('--source <path>', 'Read-only source repository for a migration')
		.option('--confirm-target', 'Confirm the current directory is the only repository to modify')
		.description('Initialize a Jira-driven task workflow')
		.action(async (jiraKey: string, options: { source?: string; confirmTarget?: boolean }) => {
			const app = await getApp();
			const result = await app.orchestrator.startTask(jiraKey, {
				sourceRoot: options.source,
				confirmTarget: options.confirmTarget,
			});
			printValue('Start Task', result);
		});
}
