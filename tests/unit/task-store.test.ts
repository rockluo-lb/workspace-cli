import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileTaskStore } from '../../src/core/state/task-store.js';
import { createTempDir } from '../helpers/test-env.js';

describe('task store', () => {
	it('persists task artifacts atomically', async () => {
		const rootDir = await createTempDir('vibe-store-');
		const store = new FileTaskStore(rootDir);
		await store.saveProgress('CRMCN-1', {
			jiraKey: 'CRMCN-1',
			branch: 'feat/CRMCN-1',
			completedSteps: [],
			commits: [],
			status: 'initialized',
		});
		await store.writeTaskFile('CRMCN-1', 'plan.md', '# Plan');
		const progress = await store.loadProgress('CRMCN-1');
		expect(progress?.branch).toBe('feat/CRMCN-1');
		expect(await fs.pathExists(path.join(rootDir, '.vibe/tasks/CRMCN-1/plan.md'))).toBe(true);
	});

	it('clears the entire .vibe directory', async () => {
		const rootDir = await createTempDir('vibe-store-clean-');
		const store = new FileTaskStore(rootDir);
		await store.saveProgress('CRMCN-1', {
			jiraKey: 'CRMCN-1',
			branch: 'feat/CRMCN-1',
			completedSteps: [],
			commits: [],
			status: 'initialized',
		});

		await expect(store.clearVibeDir()).resolves.toBe(true);
		await expect(fs.pathExists(path.join(rootDir, '.vibe'))).resolves.toBe(false);
	});

	it('returns false when .vibe does not exist', async () => {
		const rootDir = await createTempDir('vibe-store-empty-');
		const store = new FileTaskStore(rootDir);

		await expect(store.clearVibeDir()).resolves.toBe(false);
	});
});
