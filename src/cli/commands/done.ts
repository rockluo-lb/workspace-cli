import type { Command } from 'commander';
import { AppError } from '../../core/shared/errors.js';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerDoneCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('done')
		.argument('<jiraKey>')
		.requiredOption('--step <number>', 'Step number', (value) => Number.parseInt(value, 10))
		.option('--dry-run', 'Do not apply source changes')
		.description('Execute a plan step, code review it, and commit when the review passes')
		.action(async (jiraKey: string, options: { step: number; dryRun?: boolean }) => {
			const app = await getApp();
			const codeResult = await app.orchestrator.executeStep(jiraKey, options.step, {
				dryRun: options.dryRun,
			});
			printValue(`Execute Step ${options.step}`, codeResult);

			const reviewResult = await app.orchestrator.reviewCode(jiraKey, options.step);
			printValue(`Code Review Step ${options.step}`, reviewResult);

			if (!reviewResult.review.passed) {
				throw new AppError(
					'CODE_REVIEW_NOT_PASSED',
					[
						`Code review did not pass for step ${options.step} (risk ${reviewResult.review.riskScore} > threshold ${reviewResult.review.threshold}).`,
						`Report: ${reviewResult.reportPath}`,
						reviewResult.nextAction,
					].join('\n')
				);
			}

			const commitResult = await app.orchestrator.commitStep(jiraKey, options.step);
			printValue(`Commit Step ${options.step}`, commitResult);
		});
}
