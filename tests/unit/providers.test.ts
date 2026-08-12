import { describe, expect, it } from 'vitest';
import { MockAIProvider } from '../../src/core/planning/mock-ai-provider.js';
import { FigmaMcpProvider } from '../../src/core/tools/figma/figma-mcp-provider.js';
import { GitHubMcpProvider } from '../../src/core/tools/github/github-mcp-provider.js';
import { AtlassianMcpProvider } from '../../src/core/tools/jira/atlassian-mcp-provider.js';
import { AtlassianPluginProvider } from '../../src/core/tools/jira/atlassian-plugin-provider.js';

describe('provider contracts', () => {
	it('returns synthetic jira context', async () => {
		const provider = new AtlassianPluginProvider();
		const issue = await provider.getIssue('CRMCN-11');
		expect(issue.key).toBe('CRMCN-11');
	});

	it('returns synthetic jira context from the mcp provider', async () => {
		const provider = new AtlassianMcpProvider();
		const issue = await provider.getIssue('CRMCN-12');
		expect(issue.key).toBe('CRMCN-12');
	});

	it('parses figma urls', async () => {
		const provider = new FigmaMcpProvider();
		const ref = await provider.parseUrl('https://www.figma.com/design/FILE123/Test?node-id=1-2');
		expect(ref.fileId).toBe('FILE123');
		expect(ref.nodeId).toBe('1-2');
	});

	it('returns synthetic github repo context', async () => {
		const provider = new GitHubMcpProvider();
		const repo = await provider.getRepositoryMeta('lifebyte-systems/TMGM-CRM-Back-End');
		expect(repo.defaultBranch).toBe('main');
	});

	it('returns mock ai plan output', async () => {
		const provider = new MockAIProvider();
		const draft = await provider.generatePlan({
			issue: {
				key: 'CRMCN-1',
				summary: 'Summary',
				acceptanceCriteria: [],
				labels: [],
				links: [],
			},
			links: [],
			repoContext: {
				repoName: 'repo',
				packageManager: 'pnpm',
				workspaceType: 'single',
				apps: [],
				packages: [],
				routes: [],
				testTools: [],
				partial: true,
			},
			config: {
				branchPattern: 'feat/{jiraKey}',
				commitPattern: 'feat({jiraKey}): {message}',
				baseBranch: 'main',
				jira: { provider: 'auto', fallbackProvider: 'atlassian-plugin', allowedPrefixes: ['CRMCN'] },
				figma: { provider: 'figma-mcp' },
				github: { provider: 'github-mcp' },
				pr: {
					aiDisclosure:
						'> This PR draft was generated with vibe-cli AI assistance. Please review all changes carefully before merging.',
				},
				planning: { minSteps: 3, maxSteps: 7, maxFilesPerStep: 12 },
				verify: { stepCommands: ['git status --short'], taskCommands: ['git status --short'] },
				review: { uncertaintyThreshold: 0.2, maxIterations: 3 },
			},
		});
		expect(draft.steps.length).toBeGreaterThan(0);
	});
});
