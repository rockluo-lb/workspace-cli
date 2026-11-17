import { Option, type Command } from 'commander';
import type { BriefRole } from '../../core/shared/types.js';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerBriefCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('brief')
		.argument('<jiraKey>')
		.addOption(
			new Option('--role <role>', 'Sub-agent role the brief is for')
				.choices(['coding', 'branch-review'])
				.default('coding')
		)
		.option('--step <number>', 'Step number (required for coding)', (value) => Number.parseInt(value, 10))
		.option(
			'--note <text>',
			'Lead instruction to include in the brief',
			(value: string, previous: string[]) => [...previous, value],
			[] as string[]
		)
		.description('Write a role brief that a sub-agent reads instead of the full skill and context')
		.action(async (jiraKey: string, options: { role: BriefRole; step?: number; note: string[] }) => {
			const app = await getApp();
			const result = await app.orchestrator.buildBrief(jiraKey, {
				role: options.role,
				stepId: options.step,
				notes: options.note,
			});
			printValue('Build Brief', result);
		});
}
