import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerMemoryCommand(program: Command, getApp: () => Promise<AppContext>): void {
	const memory = program.command('memory').description('List or review repo lessons suggested after a finished task');

	memory.action(async () => {
		const app = await getApp();
		printValue('Lessons', await app.orchestrator.listLessons());
	});

	memory
		.command('approve')
		.requiredOption('--id <id>', 'Lesson id')
		.action(async (options: { id: string }) => {
			const app = await getApp();
			printValue('Approve Lesson', await app.orchestrator.setLessonStatus(options.id, 'approved'));
		});

	memory
		.command('reject')
		.requiredOption('--id <id>', 'Lesson id')
		.action(async (options: { id: string }) => {
			const app = await getApp();
			printValue('Reject Lesson', await app.orchestrator.setLessonStatus(options.id, 'rejected'));
		});
}
