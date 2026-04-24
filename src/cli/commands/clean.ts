import fs from 'fs-extra';
import { resolveWorkspaceStateDir } from '../../core/shared/state-paths.js';
import type { Command } from 'commander';
import { printValue } from '../runtime.js';

export function registerCleanCommand(program: Command): void {
	program
		.command('clean')
		.description('Delete the global workspace state directory used by vibe-cli')
		.action(async () => {
			const stateRoot = resolveWorkspaceStateDir(process.cwd());
			const removed = await fs.pathExists(stateRoot);
			if (removed) {
				await fs.remove(stateRoot);
			}
			printValue('Clean Workspace', {
				path: stateRoot,
				removed,
				summary: removed ? 'Deleted workspace Vibe task state.' : 'No workspace Vibe task state found.',
			});
		});
}
