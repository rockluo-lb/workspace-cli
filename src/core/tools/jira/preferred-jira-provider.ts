import { AppError, CapabilityUnavailableError } from '../../shared/errors.js';
import type {
	ConfluencePageContext,
	ExternalLink,
	IssueCommentContext,
	JiraIssueContext,
	JiraProvider,
} from '../../shared/types.js';

function isCapabilityUnavailable(error: unknown): boolean {
	return error instanceof CapabilityUnavailableError || (error instanceof AppError && error.code === 'CAPABILITY_UNAVAILABLE');
}

export class PreferredJiraProvider implements JiraProvider {
	private activeProvider: JiraProvider | null = null;

	constructor(private readonly providers: JiraProvider[]) {}

	async getIssue(issueKey: string): Promise<JiraIssueContext> {
		return this.withProvider((provider) => provider.getIssue(issueKey));
	}

	async getIssueLinks(issueKey: string): Promise<ExternalLink[]> {
		return this.withProvider((provider) => provider.getIssueLinks(issueKey));
	}

	async getIssueComments(issueKey: string): Promise<IssueCommentContext[]> {
		return this.withProvider((provider) => provider.getIssueComments(issueKey));
	}

	async resolveConfluence(url: string): Promise<ConfluencePageContext | null> {
		return this.withProvider((provider) => provider.resolveConfluence(url));
	}

	private async withProvider<T>(run: (provider: JiraProvider) => Promise<T>): Promise<T> {
		if (this.activeProvider) {
			return run(this.activeProvider);
		}

		let lastCapabilityError: unknown = null;

		for (const provider of this.providers) {
			try {
				const result = await run(provider);
				this.activeProvider = provider;
				return result;
			} catch (error) {
				if (isCapabilityUnavailable(error)) {
					lastCapabilityError = error;
					continue;
				}
				throw error;
			}
		}

		throw (
			lastCapabilityError ??
			new CapabilityUnavailableError('No Jira provider is available. Configure an Atlassian MCP or plugin bridge.')
		);
	}
}
