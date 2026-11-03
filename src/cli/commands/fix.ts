import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerFixCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('fix')
		.argument('<jiraKey>')
		.requiredOption('--message <text>', 'Commit message body for the fix step')
		.requiredOption(
			'--file <path>',
			'Relative file the fix is allowed to change',
			(value: string, previous: string[]) => [...previous, value],
			[] as string[]
		)
		.description('Append a fix step after all plan steps are committed')
		.action(async (jiraKey: string, options: { message: string; file: string[] }) => {
			const app = await getApp();
			const result = await app.orchestrator.addFixStep(jiraKey, options.message, options.file);
			printValue('Add Fix Step', result);
		});
}
