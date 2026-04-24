import fs from 'fs-extra';
import { execFileSync } from 'node:child_process';
import os from 'node:os';
import path from 'node:path';
import { defaultConfig } from '../../src/core/shared/config.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import type { VibeConfig } from '../../src/core/shared/types.js';

export async function createTempRepo(overrides?: Partial<VibeConfig>): Promise<string> {
	const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-flow-cli-'));
	execFileSync('git', ['init', '-b', 'main'], { cwd: rootDir });
	execFileSync('git', ['config', 'user.email', 'test@example.com'], { cwd: rootDir });
	execFileSync('git', ['config', 'user.name', 'Test User'], { cwd: rootDir });

	const stateBaseDir = process.env.VIBE_STATE_ROOT ?? (await fs.mkdtemp(path.join(os.tmpdir(), 'vibe-state-')));
	process.env.VIBE_STATE_ROOT = stateBaseDir;
	const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
	await fs.ensureDir(stateRoot);
	const config: VibeConfig = {
		...defaultConfig,
		...overrides,
		github: {
			...defaultConfig.github,
			repository: 'lifebyte-systems/TMGM-CRM-Back-End',
			...overrides?.github,
		},
		verify: {
			stepCommands: ['git status --short'],
			taskCommands: ['git status --short'],
			...overrides?.verify,
		},
	};
	await fs.writeJson(path.join(stateRoot, 'config.json'), config, { spaces: 2 });
	await fs.writeFile(path.join(rootDir, '.gitignore'), '.cursor/\n', 'utf8');
	await fs.writeFile(path.join(rootDir, 'README.md'), '# Temp Repo\n', 'utf8');

	execFileSync('git', ['add', '.'], { cwd: rootDir });
	execFileSync('git', ['commit', '-m', 'chore: init'], { cwd: rootDir });
	return rootDir;
}
