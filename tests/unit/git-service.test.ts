import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimpleGitService } from '../../src/core/git/local-git-service.js';
import { createTempDir, initGitRepo } from '../helpers/test-env.js';

describe('git service', () => {
	it('shows dirty files in the clean worktree error', async () => {
		const rootDir = await createTempDir('vibe-git-service-');
		await initGitRepo(rootDir);
		await fs.writeFile(path.join(rootDir, 'dirty.txt'), 'x', 'utf8');

		const service = new SimpleGitService(rootDir);

		await expect(service.ensureCleanWorktree()).rejects.toMatchObject({
			code: 'GIT_DIRTY_WORKTREE',
		});

		try {
			await service.ensureCleanWorktree();
		} catch (error) {
			expect((error as Error).message).toContain('dirty.txt');
			expect((error as Error).message).toContain('Commit, stash, or discard');
		}
	});

	it('ignores .cursor files when checking worktree cleanliness and diffs', async () => {
		const rootDir = await createTempDir('vibe-git-service-cursor-');
		await initGitRepo(rootDir);
		await fs.ensureDir(path.join(rootDir, '.cursor'));
		await fs.writeFile(path.join(rootDir, '.cursor', 'state.json'), '{"ok":true}', 'utf8');

		const service = new SimpleGitService(rootDir);

		await expect(service.ensureCleanWorktree()).resolves.toBeUndefined();
		await expect(service.getDiffFiles()).resolves.toEqual([]);
		await expect(service.getDiffStat()).resolves.toEqual([]);
	});

	it('reports diff stats for tracked edits and untracked files', async () => {
		const rootDir = await createTempDir('vibe-git-service-diffstat-');
		await initGitRepo(rootDir);
		await fs.appendFile(path.join(rootDir, 'README.md'), 'line a\nline b\n', 'utf8');
		await fs.writeFile(path.join(rootDir, 'added.ts'), 'export const a = 1;\nexport const b = 2;\n', 'utf8');

		const service = new SimpleGitService(rootDir);
		const stats = await service.getDiffStat();

		const readme = stats.find((stat) => stat.file === 'README.md');
		const added = stats.find((stat) => stat.file === 'added.ts');

		expect(readme?.insertions).toBeGreaterThan(0);
		expect(added?.insertions).toBeGreaterThan(0);
		expect(added?.deletions).toBe(0);
	});
});
