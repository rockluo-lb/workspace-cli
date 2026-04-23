import type {
	ConfluencePageContext,
	ExternalLink,
	IssueCommentContext,
	JiraIssueContext,
	JiraProvider,
} from '../../shared/types.js';
import { loadFixtureMap } from '../provider-utils.js';

function extractLinksFromText(body: string | undefined): ExternalLink[] {
	if (!body) {
		return [];
	}

	const urls = body.match(/https?:\/\/[^\s)]+/g) ?? [];
	return urls.map((url) => ({
		url,
		source: 'description',
		type: url.includes('figma.com') ? 'figma' : url.includes('confluence') ? 'confluence' : 'other',
		title: url,
	}));
}

export abstract class BaseAtlassianProvider implements JiraProvider {
	async getIssue(issueKey: string): Promise<JiraIssueContext> {
		const fixtures = await loadFixtureMap<JiraIssueContext>('VIBE_JIRA_FIXTURES');
		const fixture = fixtures?.[issueKey];
		if (fixture) {
			return fixture;
		}

		return {
			key: issueKey,
			summary: `Implement workflow for ${issueKey}`,
			description: 'Synthetic Jira issue generated because no Atlassian bridge was configured.',
			acceptanceCriteria: ['Produce a valid plan', 'Keep work step-based', 'Generate PR-ready output'],
			labels: ['synthetic'],
			issueType: 'Story',
			status: 'Open',
			assignee: 'unassigned',
			links: [],
		};
	}

	async getIssueLinks(issueKey: string): Promise<ExternalLink[]> {
		const issue = await this.getIssue(issueKey);
		return [...issue.links, ...extractLinksFromText(issue.description)];
	}

	async getIssueComments(issueKey: string): Promise<IssueCommentContext[]> {
		const fixtures = await loadFixtureMap<IssueCommentContext[]>('VIBE_JIRA_COMMENTS_FIXTURES');
		return fixtures?.[issueKey] ?? [];
	}

	async resolveConfluence(url: string): Promise<ConfluencePageContext | null> {
		if (!url.includes('confluence')) {
			return null;
		}

		const fixtures = await loadFixtureMap<ConfluencePageContext>('VIBE_CONFLUENCE_FIXTURES');
		return (
			fixtures?.[url] ?? {
				url,
				title: 'Synthetic Confluence Page',
				excerpt: 'No Confluence bridge configured; using synthetic excerpt.',
			}
		);
	}
}
