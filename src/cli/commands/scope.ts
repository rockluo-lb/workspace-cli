import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerScopeCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('scope')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.requiredOption(
			'--file <path>',
			'Relative file to include in the step scope',
			(value: string, previous: string[]) => [...previous, value],
			[] as string[]
		)
		.description('Add files to a step scope before commit')
		.action(async (jiraKey: string, options: { step: number; file: string[] }) => {
			const app = await getApp();
			const result = await app.orchestrator.addStepScope(jiraKey, options.step, options.file);
			printValue('Update Scope', result);
		});
}
