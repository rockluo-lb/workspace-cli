import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadOrCreateConfig } from '../../src/core/shared/config.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import { createTempDir, useTempStateRoot } from '../helpers/test-env.js';

describe('config loading', () => {
	afterEach(() => {
		delete process.env.VIBE_STATE_ROOT;
	});

	it('creates a default config when missing', async () => {
		const rootDir = await createTempDir('vibe-config-');
		const stateBaseDir = await useTempStateRoot();
		const config = await loadOrCreateConfig(rootDir);
		expect(config.branchPattern).toBe('feat/{jiraKey}');
		expect(config.pr.aiDisclosure).toContain('vibe-cli AI assistance');
		expect(await fs.pathExists(path.join(rootDir, '.vibe'))).toBe(false);
		expect(
			await fs.pathExists(path.join(resolveWorkspaceStateDir(rootDir, stateBaseDir), 'config.json'))
		).toBe(true);
	});

	it('applies repository reviewer presets when reviewers are not provided', async () => {
		const rootDir = await createTempDir('vibe-config-reviewers-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(
			path.join(stateRoot, 'config.json'),
			{
				github: {
					repository: 'lifebyte-systems/CRM-Sales-Frontend',
				},
			},
			{ spaces: 2 }
		);

		const config = await loadOrCreateConfig(rootDir);
		expect(config.github.reviewers).toEqual(['jynxioxiao-lb', 'colinchen-lb']);
	});

	it('allows overriding reviewer presets and pr disclosure from config', async () => {
		const rootDir = await createTempDir('vibe-config-dynamic-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(
			path.join(stateRoot, 'config.json'),
			{
				github: {
					repository: 'example/repo',
					reviewerPresets: {
						'example/repo': ['alice', 'bob'],
					},
				},
				pr: {
					aiDisclosure: 'Custom disclosure.',
				},
			},
			{ spaces: 2 }
		);

		const config = await loadOrCreateConfig(rootDir);
		expect(config.github.reviewers).toEqual(['alice', 'bob']);
		expect(config.pr.aiDisclosure).toBe('Custom disclosure.');
	});
});
