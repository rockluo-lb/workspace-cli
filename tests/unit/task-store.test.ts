import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileTaskStore } from '../../src/core/state/task-store.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import { createTempDir } from '../helpers/test-env.js';

describe('task store', () => {
	it('persists task artifacts atomically', async () => {
		const rootDir = await createTempDir('vibe-store-');
		const stateRoot = resolveWorkspaceStateDir(rootDir, await createTempDir('vibe-store-state-'));
		const store = new FileTaskStore(stateRoot);
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
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-1/plan.md'))).toBe(true);
	});

	it('clears the entire workspace state directory', async () => {
		const rootDir = await createTempDir('vibe-store-clean-');
		const stateRoot = resolveWorkspaceStateDir(rootDir, await createTempDir('vibe-store-clean-state-'));
		const store = new FileTaskStore(stateRoot);
		await store.saveProgress('CRMCN-1', {
			jiraKey: 'CRMCN-1',
			branch: 'feat/CRMCN-1',
			completedSteps: [],
			commits: [],
			status: 'initialized',
		});

		await expect(store.clearStateDir()).resolves.toBe(true);
		await expect(fs.pathExists(stateRoot)).resolves.toBe(false);
	});

	it('returns false when the workspace state directory does not exist', async () => {
		const rootDir = await createTempDir('vibe-store-empty-');
		const stateRoot = resolveWorkspaceStateDir(rootDir, await createTempDir('vibe-store-empty-state-'));
		const store = new FileTaskStore(stateRoot);

		await expect(store.clearStateDir()).resolves.toBe(false);
	});
});
