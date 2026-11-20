import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerHandoffCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('handoff')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.requiredOption('--text <text>', 'What this step changed, the key files, and anything left')
		.description('Append a handoff note to the task log. It stays out of git')
		.action(async (jiraKey: string, options: { step: number; text: string }) => {
			const app = await getApp();
			const result = await app.orchestrator.recordHandoff(jiraKey, options.step, options.text);
			printValue('Record Handoff', result);
		});
}
