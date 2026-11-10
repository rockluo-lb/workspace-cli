import type { Command } from 'commander';
import fs from 'fs-extra';
import path from 'node:path';
import { parsePlanDraft } from '../../core/planning/planner.js';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerPlanCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('plan')
		.argument('<jiraKey>')
		.option('--from <file>', 'Import the plan from a JSON file instead of generating it')
		.description('Generate a step-by-step execution plan')
		.action(async (jiraKey: string, options: { from?: string }) => {
			const app = await getApp();
			const draft = options.from ? parsePlanDraft(await fs.readJson(path.resolve(options.from))) : undefined;
			const result = await app.orchestrator.generatePlan(jiraKey, { draft });
			printValue('Generate Plan', result);
		});
}
