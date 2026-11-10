import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SimpleGitService } from '../../src/core/git/local-git-service.js';
import { createTempDir, initGitRepo, run } from '../helpers/test-env.js';

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

	it('ignores gitignored .cursor files when checking worktree cleanliness and diffs', async () => {
		const rootDir = await createTempDir('vibe-git-service-cursor-');
		await initGitRepo(rootDir);
		await fs.ensureDir(path.join(rootDir, '.cursor'));
		await fs.writeFile(path.join(rootDir, '.cursor', 'state.json'), '{"ok":true}', 'utf8');

		const service = new SimpleGitService(rootDir);

		await expect(service.ensureCleanWorktree()).resolves.toBeUndefined();
		await expect(service.getDiffFiles()).resolves.toEqual([]);
		await expect(service.getDiffStat()).resolves.toEqual([]);
	});

	it('stages and commits tracked files under dot directories', async () => {
		const rootDir = await createTempDir('vibe-git-service-dotdir-');
		await initGitRepo(rootDir);
		await fs.writeFile(path.join(rootDir, '.gitignore'), '.cursor/state.json\n', 'utf8');
		run('git', ['commit', '-am', 'chore: track cursor rules'], rootDir);
		await fs.ensureDir(path.join(rootDir, '.cursor', 'rules'));
		await fs.writeFile(path.join(rootDir, '.cursor', 'state.json'), '{"ok":true}', 'utf8');
		await fs.writeFile(path.join(rootDir, '.cursor', 'rules', 'style.mdc'), '# Style\n', 'utf8');

		const service = new SimpleGitService(rootDir);
		const files = await service.getDiffFiles();
		expect(files).toEqual([path.normalize('.cursor/rules/style.mdc')]);

		await service.addFiles(files);
		await service.commit('feat(CRMCN-1): add style rule');
		expect(run('git', ['status', '--short'], rootDir)).toBe('');
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
		expect(readme?.lines).toBe(3);
		expect(added?.insertions).toBe(2);
		expect(added?.deletions).toBe(0);
		expect(added?.lines).toBe(2);
	});
});
