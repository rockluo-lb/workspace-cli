import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerShowCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('show')
		.argument('<jiraKey>')
		.description('Show the current stored state for a task')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const [issue, plan, progress] = await Promise.all([
				app.taskStore.loadIssue(jiraKey),
				app.taskStore.loadPlan(jiraKey),
				app.taskStore.loadProgress(jiraKey),
			]);
			printValue('Task Snapshot', { issue, plan, progress });
		});
}
