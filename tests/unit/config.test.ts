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
		expect(config.codeReview.maxInsertions).toBe(1000);
		expect(config.codeReview.maxFileLines).toBe(300);
		expect(await fs.pathExists(path.join(rootDir, '.vibe'))).toBe(false);
		expect(
			await fs.pathExists(path.join(resolveWorkspaceStateDir(rootDir, stateBaseDir), 'config.json'))
		).toBe(true);
	});

	it('allows overriding the pr disclosure from config', async () => {
		const rootDir = await createTempDir('vibe-config-dynamic-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(
			path.join(stateRoot, 'config.json'),
			{
				github: {
					repository: 'example/repo',
				},
				pr: {
					aiDisclosure: 'Custom disclosure.',
				},
			},
			{ spaces: 2 }
		);

		const config = await loadOrCreateConfig(rootDir);
		expect(config.pr.aiDisclosure).toBe('Custom disclosure.');
	});

	it('infers verify scripts and keeps the configured base branch for a new config', async () => {
		const rootDir = await createTempDir('vibe-config-infer-');
		await useTempStateRoot();
		await fs.writeJson(path.join(rootDir, 'package.json'), {
			scripts: {
				'lint:ts': 'tsc --noEmit',
				'specs:check': 'node scripts/check.js',
				test: 'vitest run',
				build: 'tsc',
			},
		});
		await initGitRepo(rootDir);
		run('git', ['checkout', '-b', 'latest'], rootDir);

		const config = await loadOrCreateConfig(rootDir);
		expect(config.baseBranch).toBe('main');
		expect(config.jira.allowedPrefixes).toEqual([]);
		expect(config.verify.stepCommands).toEqual(['pnpm lint:ts']);
		expect(config.verify.taskCommands).toEqual(['pnpm lint:ts', 'pnpm specs:check', 'pnpm test', 'pnpm build']);
	});

	it('lints only changed files per step when the repo uses eslint', async () => {
		const rootDir = await createTempDir('vibe-config-eslint-');
		await useTempStateRoot();
		await fs.writeJson(path.join(rootDir, 'package.json'), {
			scripts: { 'lint:ts': 'tsc --noEmit', build: 'tsc' },
			devDependencies: { eslint: '^10.0.0' },
		});
		await fs.writeFile(path.join(rootDir, 'yarn.lock'), '', 'utf8');

		const config = await loadOrCreateConfig(rootDir);
		expect(config.verify.stepCommands).toEqual(['yarn eslint {files}']);
		expect(config.verify.taskCommands).toEqual(['yarn lint:ts', 'yarn build']);
	});
});
