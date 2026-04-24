import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/core/create-app.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import { createTempDir, initGitRepo, run, useTempStateRoot } from '../helpers/test-env.js';

describe('workflow integration', () => {
	afterEach(() => {
		delete process.env.VIBE_STATE_ROOT;
	});

	it('runs the main task lifecycle', async () => {
		const rootDir = await createTempDir('vibe-workflow-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await initGitRepo(rootDir);

		const app = await createApp(rootDir);
		const start = await app.orchestrator.startTask('CRMCN-1234');
		expect(start.initialBranch).toBe('main');
		expect(start.baseBranch).toBe('main');
		expect(start.branch).toBe('feat/CRMCN-1234');
		expect(start.currentBranch).toBe('feat/CRMCN-1234');
		expect(await fs.pathExists(path.join(rootDir, '.vibe'))).toBe(false);
		expect(run('git', ['branch', '--show-current'], rootDir)).toBe('feat/CRMCN-1234');

		const plan = await app.orchestrator.generatePlan('CRMCN-1234');
		expect(plan.plan.steps.length).toBeGreaterThanOrEqual(3);
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-1234/plan.md'))).toBe(true);

		const code = await app.orchestrator.executeStep('CRMCN-1234', 1, { dryRun: true });
		expect(code.summary).toContain('step 1');
		expect(run('git', ['status', '--short'], rootDir)).toBe('');

		await fs.appendFile(path.join(rootDir, 'README.md'), 'Step 1 change\n', 'utf8');
		const commit = await app.orchestrator.commitStep('CRMCN-1234', 1);
		expect(commit.message).toMatch(/^feat\(CRMCN-1234\): /);
		expect(run('git', ['log', '-1', '--pretty=%s'], rootDir)).toBe(commit.message);

		const pr = await app.orchestrator.preparePR('CRMCN-1234');
		expect(pr.content).toContain('CRMCN-1234');
		expect(pr.content).toContain('This PR draft was generated with vibe-cli AI assistance.');
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-1234/reports/pr.md'))).toBe(true);

		const resume = await app.orchestrator.resumeTask('CRMCN-1234');
		expect(resume.pendingSteps).toContain(2);
		expect(resume.nextAction).toContain('vibe code CRMCN-1234 --step 2');
	});

	it('creates the task branch from the current branch by default', async () => {
		const rootDir = await createTempDir('vibe-workflow-branch-base-');
		await useTempStateRoot();
		await initGitRepo(rootDir);
		run('git', ['checkout', '-b', 'epic/CRMCN-11269'], rootDir);

		const app = await createApp(rootDir);
		const start = await app.orchestrator.startTask('CRMCN-5678');

		expect(start.initialBranch).toBe('epic/CRMCN-11269');
		expect(start.baseBranch).toBe('epic/CRMCN-11269');
		expect(start.currentBranch).toBe('feat/CRMCN-5678');
		expect(run('git', ['branch', '--show-current'], rootDir)).toBe('feat/CRMCN-5678');
	});
});
