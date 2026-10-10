import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { loadOrCreateConfig } from '../../src/core/shared/config.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import { createTempDir, initGitRepo, run, useTempStateRoot } from '../helpers/test-env.js';

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
		expect(config.review.uncertaintyThreshold).toBe(0.2);
		expect(config.review.maxIterations).toBe(3);
		expect(config.codeReview.riskThreshold).toBe(0.25);
		expect(config.codeReview.maxNewFiles).toBe(3);
		expect(config.codeReview.maxInsertions).toBe(400);
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

	it('infers verify scripts and the latest base branch for a new config', async () => {
		const rootDir = await createTempDir('vibe-config-infer-');
		await useTempStateRoot();
		await fs.writeJson(path.join(rootDir, 'package.json'), {
			scripts: {
				'lint:ts': 'tsc --noEmit',
				'specs:check': 'node scripts/check.js',
				build: 'tsc',
			},
		});
		await initGitRepo(rootDir);
		run('git', ['checkout', '-b', 'latest'], rootDir);

		const config = await loadOrCreateConfig(rootDir);
		expect(config.baseBranch).toBe('latest');
		expect(config.verify.stepCommands).toEqual(['pnpm lint:ts']);
		expect(config.verify.taskCommands).toEqual(['pnpm lint:ts', 'pnpm specs:check', 'pnpm build']);
	});
});
