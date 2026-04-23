import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateConfig } from '../../src/core/shared/config.js';
import { createTempDir } from '../helpers/test-env.js';

describe('config loading', () => {
	it('creates a default config when missing', async () => {
		const rootDir = await createTempDir('vibe-config-');
		const config = await loadOrCreateConfig(rootDir);
		expect(config.branchPattern).toBe('feat/{jiraKey}');
		expect(config.pr.aiDisclosure).toContain('vibe-cli AI assistance');
		expect(await fs.pathExists(path.join(rootDir, '.vibe', 'config.json'))).toBe(true);
	});

	it('applies repository reviewer presets when reviewers are not provided', async () => {
		const rootDir = await createTempDir('vibe-config-reviewers-');
		await fs.ensureDir(path.join(rootDir, '.vibe'));
		await fs.writeJson(
			path.join(rootDir, '.vibe', 'config.json'),
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
		await fs.ensureDir(path.join(rootDir, '.vibe'));
		await fs.writeJson(
			path.join(rootDir, '.vibe', 'config.json'),
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
