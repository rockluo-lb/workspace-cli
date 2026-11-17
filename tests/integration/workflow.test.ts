import fs from 'fs-extra';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/core/create-app.js';
import { resolveWorkspaceStateDir } from '../../src/core/shared/state-paths.js';
import { createTempDir, initGitRepo, run, useTempStateRoot } from '../helpers/test-env.js';

describe('workflow integration', () => {
	afterEach(() => {
		delete process.env.VIBE_STATE_ROOT;
		delete process.env.VIBE_JIRA_FIXTURES;
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

		await expect(app.orchestrator.executeStep('CRMCN-1234', 1, { dryRun: true })).rejects.toThrow(
			/not approved/
		);

		const review = await app.orchestrator.reviewPlan('CRMCN-1234');
		expect(typeof review.review.uncertaintyScore).toBe('number');
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-1234/reports/review.md'))).toBe(true);
		if (!review.review.approved) {
			await app.orchestrator.reviewPlan('CRMCN-1234');
			await app.orchestrator.reviewPlan('CRMCN-1234');
		}

		const code = await app.orchestrator.executeStep('CRMCN-1234', 1, { dryRun: true });
		expect(code.summary).toContain('step 1');
		await app.orchestrator.executeStep('CRMCN-1234', 1, { dryRun: true });
		expect(run('git', ['status', '--short'], rootDir)).toBe('');

		await fs.appendFile(path.join(rootDir, 'README.md'), 'Step 1 change\n', 'utf8');

		await expect(app.orchestrator.commitStep('CRMCN-1234', 2)).rejects.toMatchObject({
			code: 'STEP_NOT_CHECKED',
		});
		expect((await app.orchestrator.resumeTask('CRMCN-1234')).nextAction).toBe('vibe commit CRMCN-1234 --step 1');

		const commit = await app.orchestrator.commitStep('CRMCN-1234', 1);
		expect(commit.message).toMatch(/^feat\(CRMCN-1234\): /);
		expect(run('git', ['log', '-1', '--pretty=%s'], rootDir)).toBe(commit.message);

		await expect(app.orchestrator.generatePlan('CRMCN-1234')).rejects.toThrow(/already committed/);
		await expect(app.orchestrator.verifyTask('CRMCN-1234')).rejects.toThrow(/not committed/);
		await expect(app.orchestrator.preparePR('CRMCN-1234')).rejects.toThrow(/not committed/);
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-1234/reports/pr.md'))).toBe(false);

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

	it('accepts a configured Jira prefix and records the write target', async () => {
		const rootDir = await createTempDir('vibe-workflow-prefix-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await initGitRepo(rootDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(path.join(stateRoot, 'config.json'), {
			jira: { allowedPrefixes: ['PJ'] },
		});

		const app = await createApp(rootDir);
		const start = await app.orchestrator.startTask('PJ-914');
		expect(start.branch).toBe('feat/PJ-914');
		expect(start.targetRoot).toBe(rootDir);
		expect(start.confirmation).toContain('Target repository:');
	});

	it('refuses a migration until the target repository is confirmed', async () => {
		const rootDir = await createTempDir('vibe-workflow-migration-');
		await useTempStateRoot();
		await initGitRepo(rootDir);
		process.env.VIBE_JIRA_FIXTURES = JSON.stringify({
			'CRMCN-9001': {
				key: 'CRMCN-9001',
				summary: '把旧项目功能迁移到 Jungle',
				acceptanceCriteria: ['行为保持一致'],
				labels: [],
				links: [],
			},
		});

		const app = await createApp(rootDir);
		await expect(app.orchestrator.startTask('CRMCN-9001')).rejects.toThrow(/confirm-target/);
		expect(run('git', ['branch', '--show-current'], rootDir)).toBe('main');

		const start = await app.orchestrator.startTask('CRMCN-9001', {
			confirmTarget: true,
			sourceRoot: '/tmp/staff',
		});
		expect(start.sourceRoot).toBe('/tmp/staff');
		expect(start.confirmation).toContain('/tmp/staff');
	});

	it('imports a plan file and keeps its decisions when the plan is regenerated', async () => {
		const rootDir = await createTempDir('vibe-workflow-import-');
		await useTempStateRoot();
		await initGitRepo(rootDir);
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-77');

		const decisions = [{ question: 'Keep the old route?', answer: 'Yes' }];
		const imported = await app.orchestrator.generatePlan('CRMCN-77', {
			draft: {
				summary: 'Imported',
				decisions,
				steps: [{ title: 'Update readme', expectedFiles: ['README.md'] }],
			},
		});
		expect(imported.plan.steps).toHaveLength(1);
		expect(imported.plan.decisions).toEqual(decisions);
		expect(await fs.readFile(imported.reportPath, 'utf8')).toContain('Keep the old route?');

		const regenerated = await app.orchestrator.generatePlan('CRMCN-77');
		expect(regenerated.plan.decisions).toEqual(decisions);
	});

	it('writes role briefs with the step, decisions, notes, and matched rules', async () => {
		const rootDir = await createTempDir('vibe-workflow-brief-');
		await useTempStateRoot();
		await initGitRepo(rootDir);
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-55');
		await app.orchestrator.generatePlan('CRMCN-55', {
			draft: {
				decisions: [{ question: 'Keep pagination?', answer: 'Yes' }],
				steps: [
					{ title: 'Edit list view', expectedFiles: ['src/views/list.vue'] },
					{ title: 'Add api', expectedFiles: ['src/api/list.ts'] },
				],
			},
		});
		const rulesDir = path.join(rootDir, '.cursor', 'rules');
		await fs.ensureDir(rulesDir);
		await fs.writeFile(
			path.join(rulesDir, 'tailwind.mdc'),
			"---\ndescription: Tailwind\nglobs: ['**/*.vue']\n---\n\nUse design tokens.\n",
			'utf8'
		);

		const coding = await app.orchestrator.buildBrief('CRMCN-55', {
			role: 'coding',
			stepId: 1,
			notes: ['Match the TMGM portal first'],
		});
		const content = await fs.readFile(coding.reportPath, 'utf8');
		expect(path.basename(coding.reportPath)).toBe('step-1-coding-brief.md');
		expect(coding.appliedRules).toEqual(['.cursor/rules/tailwind.mdc']);
		expect(content).toContain('vibe code CRMCN-55 --step 1');
		expect(content).toContain('Use design tokens.');
		expect(content).toContain('Keep pagination?');
		expect(content).toContain('Match the TMGM portal first');
		expect(content).not.toContain('Step 2: Add api');

		const branch = await app.orchestrator.buildBrief('CRMCN-55', { role: 'branch-review' });
		const branchContent = await fs.readFile(branch.reportPath, 'utf8');
		expect(path.basename(branch.reportPath)).toBe('branch-review-brief.md');
		expect(branchContent).toContain('git diff main...HEAD');
		expect(branchContent).toContain('Step 2: Add api');

		await expect(app.orchestrator.buildBrief('CRMCN-55', { role: 'coding' })).rejects.toMatchObject({
			code: 'STEP_NOT_FOUND',
		});
	});

	it('stops a step when verification fails and can extend scope before commit', async () => {
		const rootDir = await createTempDir('vibe-workflow-verify-');
		await useTempStateRoot();
		await initGitRepo(rootDir);
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-42');
		await app.orchestrator.generatePlan('CRMCN-42');
		const scoped = await app.orchestrator.addStepScope('CRMCN-42', 1, ['src/router/routes.tsx']);
		expect(scoped.expectedFiles).toContain('src/router/routes.tsx');

		let review = await app.orchestrator.reviewPlan('CRMCN-42');
		if (!review.review.approved) {
			await app.orchestrator.reviewPlan('CRMCN-42');
			review = await app.orchestrator.reviewPlan('CRMCN-42');
		}
		expect(review.review.approved).toBe(true);

		const plan = await app.taskStore.loadPlan('CRMCN-42');
		if (!plan) {
			throw new Error('missing plan');
		}
		const step = plan.steps[0];
		if (!step) {
			throw new Error('missing step');
		}
		step.verifyCommands = ['node -e "process.exit(1)"'];
		await app.taskStore.savePlan('CRMCN-42', plan);

		await expect(app.orchestrator.executeStep('CRMCN-42', 1)).rejects.toThrow(/verification failed/);
		const progress = await app.taskStore.loadProgress('CRMCN-42');
		expect(progress?.status).toBe('failed');
		expect(run('git', ['log', '-1', '--pretty=%s'], rootDir)).toBe('chore: initial');
	});

	it('appends a fix step after task verification fails', async () => {
		const rootDir = await createTempDir('vibe-workflow-fix-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await initGitRepo(rootDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(path.join(stateRoot, 'config.json'), {
			verify: { stepCommands: [], taskCommands: ['node -e "process.exit(1)"'] },
		});
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-88');
		await app.orchestrator.generatePlan('CRMCN-88');

		await expect(app.orchestrator.addFixStep('CRMCN-88', 'too early', ['README.md'])).rejects.toThrow(
			/not committed yet/
		);

		const plan = await app.taskStore.loadPlan('CRMCN-88');
		if (!plan) {
			throw new Error('missing plan');
		}
		plan.steps = plan.steps.map((step) => ({ ...step, status: 'committed' as const }));
		await app.taskStore.savePlan('CRMCN-88', plan);
		const progress = await app.taskStore.loadProgress('CRMCN-88');
		if (!progress) {
			throw new Error('missing progress');
		}
		await app.taskStore.saveProgress('CRMCN-88', { ...progress, status: 'coding' });
		await expect(app.orchestrator.verifyTask('CRMCN-88')).rejects.toThrow(/verification failed/);

		const fix = await app.orchestrator.addFixStep('CRMCN-88', 'restore lint', ['README.md']);
		expect(fix.stepId).toBe(plan.steps.length + 1);
		expect(fix.commitMessage).toBe('fix(CRMCN-88): restore lint');
		expect(fix.nextAction).toBe(`vibe code CRMCN-88 --step ${fix.stepId}`);
		expect((await app.taskStore.loadProgress('CRMCN-88'))?.status).toBe('plan_approved');

		await app.orchestrator.executeStep('CRMCN-88', fix.stepId);
		await fs.appendFile(path.join(rootDir, 'README.md'), 'fix\n', 'utf8');
		const review = await app.orchestrator.reviewCode('CRMCN-88', fix.stepId);
		expect(review.review.passed).toBe(true);
		await app.orchestrator.commitStep('CRMCN-88', fix.stepId);
		expect(run('git', ['log', '-1', '--pretty=%s'], rootDir)).toBe('fix(CRMCN-88): restore lint');
		await expect(app.orchestrator.preparePR('CRMCN-88')).rejects.toThrow(/not pr_ready/);
	});

	it('drafts a PR only after every step is committed and verified', async () => {
		const rootDir = await createTempDir('vibe-workflow-pr-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await initGitRepo(rootDir);
		await fs.ensureDir(stateRoot);
		await fs.writeJson(path.join(stateRoot, 'config.json'), {
			verify: { stepCommands: [], taskCommands: ['node -e "process.exit(0)"'] },
		});
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-99');
		await app.orchestrator.generatePlan('CRMCN-99');

		const plan = await app.taskStore.loadPlan('CRMCN-99');
		const progress = await app.taskStore.loadProgress('CRMCN-99');
		if (!plan || !progress) {
			throw new Error('missing state');
		}
		plan.steps = plan.steps.map((step) => ({ ...step, status: 'committed' as const }));
		await app.taskStore.savePlan('CRMCN-99', plan);
		await app.taskStore.saveProgress('CRMCN-99', { ...progress, status: 'coding' });
		await expect(app.orchestrator.preparePR('CRMCN-99')).rejects.toThrow(/not pr_ready/);

		await app.orchestrator.verifyTask('CRMCN-99');
		const pr = await app.orchestrator.preparePR('CRMCN-99');
		expect(pr.content).toContain('CRMCN-99');
		expect(pr.content).toContain('This PR draft was generated with vibe-cli AI assistance.');
		expect(await fs.pathExists(path.join(stateRoot, 'tasks/CRMCN-99/reports/pr.md'))).toBe(true);
	});

	it('rebuilds task state from commits on the feature branch', async () => {
		const rootDir = await createTempDir('vibe-workflow-adopt-');
		const stateBaseDir = await useTempStateRoot();
		const stateRoot = resolveWorkspaceStateDir(rootDir, stateBaseDir);
		await initGitRepo(rootDir);
		const app = await createApp(rootDir);
		await app.orchestrator.startTask('CRMCN-77');
		run('git', ['commit', '--allow-empty', '-m', 'feat(CRMCN-77): recover dashboard'], rootDir);
		await fs.remove(path.join(stateRoot, 'tasks', 'CRMCN-77'));

		const adopted = await app.orchestrator.adoptTask('CRMCN-77');
		expect(adopted.status).toBe('verifying');
		expect(adopted.commits).toHaveLength(1);
		expect(adopted.nextAction).toContain('vibe verify CRMCN-77');

		const aborted = await app.orchestrator.abortTask('CRMCN-77');
		expect(aborted.commits).toHaveLength(1);
		expect(run('git', ['branch', '--show-current'], rootDir)).toBe('feat/CRMCN-77');
	});
});
