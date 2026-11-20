import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerLearnCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('learn')
		.argument('<jiraKey>')
		.description('After verification, suggest repo lessons. They stay pending until approved')
		.action(async (jiraKey: string) => {
			const app = await getApp();
			const result = await app.orchestrator.learnTask(jiraKey);
			printValue('Learn', result);
		});
}
