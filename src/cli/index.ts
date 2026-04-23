#!/usr/bin/env node
import { Command } from 'commander';
import process from 'node:process';
import { AppError, toAppError } from '../core/shared/errors.js';
import { registerAbortCommand } from './commands/abort.js';
import { registerCleanCommand } from './commands/clean.js';
import { registerCodeCommand } from './commands/code.js';
import { registerCommitCommand } from './commands/commit.js';
import { registerContextCommand } from './commands/context.js';
import { registerPlanCommand } from './commands/plan.js';
import { registerPrCommand } from './commands/pr.js';
import { registerResumeCommand } from './commands/resume.js';
import { registerShowCommand } from './commands/show.js';
import { registerStartCommand } from './commands/start.js';
import { registerVerifyCommand } from './commands/verify.js';
import { renderErrorScreen } from './render.js';
import { createAppLoader } from './runtime.js';

async function main(): Promise<void> {
	const program = new Command();
	const getApp = createAppLoader(process.cwd());

	program.name('vibe').description('Jira-driven step-based vibe coding workflow CLI').version('0.1.0');

	registerStartCommand(program, getApp);
	registerContextCommand(program, getApp);
	registerPlanCommand(program, getApp);
	registerShowCommand(program, getApp);
	registerCodeCommand(program, getApp);
	registerCommitCommand(program, getApp);
	registerVerifyCommand(program, getApp);
	registerPrCommand(program, getApp);
	registerResumeCommand(program, getApp);
	registerAbortCommand(program, getApp);
	registerCleanCommand(program, getApp);

	await program.parseAsync(process.argv);
}

main().catch((error) => {
	const appError = toAppError(error);
	const details =
		error instanceof AppError && error.cause instanceof Error
			? (error.cause.stack ?? error.cause.message)
			: undefined;
	process.stderr.write(renderErrorScreen(appError.code, appError.message, details));
	if (error instanceof AppError && error.cause instanceof Error) {
		process.stderr.write('\n');
	}
	process.exit(appError.exitCode);
});
