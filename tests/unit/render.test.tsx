import { describe, expect, it } from 'vitest';
import { renderErrorScreen, renderValueScreen } from '../../src/cli/render.js';

describe('ink renderer', () => {
	it('renders a start dashboard', () => {
		const output = renderValueScreen('Start Task', {
			jiraKey: 'CRMCN-1234',
			initialBranch: 'latest',
			baseBranch: 'latest',
			branch: 'feat/CRMCN-1234',
			currentBranch: 'feat/CRMCN-1234',
			taskDir: '/Users/test/Library/Application Support/vibe-cli/workspaces/demo-123/tasks/CRMCN-1234',
			warnings: ['partial figma context'],
		});

		expect(output).toContain('Branch Flow');
		expect(output).toContain('feat/CRMCN-1234');
		expect(output).toContain('Task Dir');
		expect(output).toContain('partial figma context');
	});

	it('renders a plan dashboard', () => {
		const output = renderValueScreen('Generate Plan', {
			jiraKey: 'CRMCN-1234',
			reportPath: '/Users/test/Library/Application Support/vibe-cli/workspaces/demo-123/tasks/CRMCN-1234/plan.md',
			plan: {
				jiraKey: 'CRMCN-1234',
				branch: 'feat/CRMCN-1234',
				summary: 'Implement a tracked feature flow.',
				assumptions: ['API exists'],
				risks: ['Context is partial'],
				steps: [
					{
						id: 1,
						title: 'Scaffold state',
						description: 'Prepare task state.',
						expectedFiles: ['src/state.ts'],
						verifyCommands: ['pnpm lint'],
						commitMessage: 'feat(CRMCN-1234): scaffold state',
						status: 'pending',
					},
				],
			},
		});

		expect(output).toContain('Plan Health');
		expect(output).toContain('Scaffold state');
		expect(output).toContain('files 1 | checks 1 | pending');
	});

	it('renders a context dashboard', () => {
		const output = renderValueScreen('Build Context', {
			jiraKey: 'CRMCN-1234',
			reportPath:
				'/Users/test/Library/Application Support/vibe-cli/workspaces/demo-123/tasks/CRMCN-1234/reports/context.md',
			repoContext: {
				repoName: 'CRM-Sales-Frontend',
				packageManager: 'pnpm',
				workspaceType: 'single',
				apps: [],
				packages: [],
				routes: [{ path: 'funding-report', file: 'src/routes/funding-report.tsx' }],
				uiFramework: 'react',
				apiPattern: 'hooks+query',
				testTools: ['vitest'],
			},
			warnings: ['Figma context is partial'],
		});

		expect(output).toContain('Repository');
		expect(output).toContain('CRM-Sales-Frontend');
		expect(output).toContain('hooks+query');
		expect(output).toContain('Figma context is partial');
	});

	it('renders a resume dashboard', () => {
		const output = renderValueScreen('Resume Task', {
			jiraKey: 'CRMCN-1234',
			status: 'planned',
			nextAction: 'vibe code CRMCN-1234 --step 1',
			pendingSteps: [1, 2],
		});

		expect(output).toContain('Next Action');
		expect(output).toContain('vibe code CRMCN-1234 --step 1');
		expect(output).toContain('step 2');
	});

	it('renders an execute-step dashboard', () => {
		const output = renderValueScreen('Execute Step 2', {
			changedFiles: ['src/feature/form.tsx', 'src/feature/hooks.ts'],
			summary: 'Prepared execution for step 2.',
			warnings: ['Repository context is partial.'],
			verifyResults: [{ command: 'pnpm lint', code: 0, stdout: '', stderr: '' }],
		});

		expect(output).toContain('Changed Files');
		expect(output).toContain('src/feature/form.tsx');
		expect(output).toContain('PASS pnpm lint');
	});

	it('renders a commit-step dashboard', () => {
		const output = renderValueScreen('Commit Step 2', {
			jiraKey: 'CRMCN-1234',
			stepId: 2,
			sha: 'abc1234',
			message: 'feat(CRMCN-1234): wire state',
		});

		expect(output).toContain('Commit');
		expect(output).toContain('abc1234');
		expect(output).toContain('wire state');
	});

	it('renders a verify dashboard', () => {
		const output = renderValueScreen('Verify Task', {
			jiraKey: 'CRMCN-1234',
			reportPath:
				'/Users/test/Library/Application Support/vibe-cli/workspaces/demo-123/tasks/CRMCN-1234/reports/verify-report.md',
			results: [
				{ command: 'pnpm lint', code: 0, stdout: '', stderr: '' },
				{ command: 'pnpm test', code: 1, stdout: '', stderr: 'failed' },
			],
		});

		expect(output).toContain('Verification Summary');
		expect(output).toContain('PASS pnpm lint');
		expect(output).toContain('FAIL pnpm test');
	});

	it('renders a task snapshot dashboard', () => {
		const output = renderValueScreen('Task Snapshot', {
			issue: { key: 'CRMCN-1234' },
			plan: { steps: [{ id: 1 }, { id: 2 }] },
			progress: {
				jiraKey: 'CRMCN-1234',
				branch: 'feat/CRMCN-1234',
				currentStep: 1,
				completedSteps: [1],
				commits: [{ step: 1, sha: 'abc', message: 'feat(CRMCN-1234): scaffold' }],
				status: 'coding',
			},
		});

		expect(output).toContain('Task Snapshot');
		expect(output).toContain('feat/CRMCN-1234');
		expect(output).toContain('Plan Steps');
		expect(output).toContain('2');
	});

	it('renders a PR dashboard', () => {
		const output = renderValueScreen('Prepare PR', {
			jiraKey: 'CRMCN-1234',
			reportPath:
				'/Users/test/Library/Application Support/vibe-cli/workspaces/demo-123/tasks/CRMCN-1234/reports/pr.md',
			content: '# Demo PR\n\n## Summary\nLine 1\nLine 2',
		});

		expect(output).toContain('PR Preview');
		expect(output).toContain('# Demo PR');
		expect(output).toContain('Artifact');
	});

	it('renders structured error output', () => {
		const output = renderErrorScreen('VERIFY_FAILED', 'Task verification failed.');
		expect(output).toContain('Vibe Flow Error');
		expect(output).toContain('VERIFY_FAILED');
		expect(output).toContain('Task verification failed.');
	});
});
