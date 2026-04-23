import type { Command } from 'commander';
import type { AppContext } from '../runtime.js';
import { printValue } from '../runtime.js';

export function registerCleanCommand(program: Command, getApp: () => Promise<AppContext>): void {
	program
		.command('clean')
		.description('Delete the local .vibe state directory')
		.action(async () => {
			const app = await getApp();
			const removed = await app.taskStore.clearVibeDir();
			printValue('Clean Workspace', {
				path: '.vibe',
				removed,
				summary: removed ? 'Deleted local Vibe task state.' : 'No local Vibe task state found.',
			});
		});
}
