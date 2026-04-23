import { AppError } from '../../shared/errors.js';
import type { JiraIssueContext } from '../../shared/types.js';
import { BaseAtlassianProvider } from './atlassian-provider-shared.js';

export class AtlassianPluginProvider extends BaseAtlassianProvider {}

export function assertIssueLoaded(issue: JiraIssueContext | null, jiraKey: string): JiraIssueContext {
	if (!issue) {
		throw new AppError('JIRA_FETCH_FAILED', `Unable to load Jira issue for ${jiraKey}`);
	}

	return issue;
}
