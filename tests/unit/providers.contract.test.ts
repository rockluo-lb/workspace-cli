import { describe, expect, it } from 'vitest';
import { FigmaMcpProvider } from '../../src/core/tools/figma/figma-mcp-provider.js';
import { GitHubMcpProvider } from '../../src/core/tools/github/github-mcp-provider.js';
import { AtlassianPluginProvider } from '../../src/core/tools/jira/atlassian-plugin-provider.js';

describe('provider contracts', () => {
	it('returns Jira issue context', async () => {
		const provider = new AtlassianPluginProvider();
		const issue = await provider.getIssue('CRMCN-1');
		expect(issue.key).toBe('CRMCN-1');
		expect(Array.isArray(issue.acceptanceCriteria)).toBe(true);
	});

	it('parses figma references', async () => {
		const provider = new FigmaMcpProvider();
		const ref = await provider.parseUrl('https://www.figma.com/design/abc123/mock?node-id=1-2');
		expect(ref.fileId).toBe('abc123');
		expect(ref.nodeId).toBe('1-2');
	});

	it('returns github metadata', async () => {
		const provider = new GitHubMcpProvider();
		const repo = await provider.getRepositoryMeta('lifebyte-systems/TMGM-CRM-Back-End');
		expect(repo.fullName).toBe('lifebyte-systems/TMGM-CRM-Back-End');
	});
});
