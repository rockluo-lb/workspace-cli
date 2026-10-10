import type { JiraIssueContext } from './types.js';

const DESCRIPTION_LIMIT = 4000;

export function slimIssue(issue: JiraIssueContext): JiraIssueContext {
	if (!issue.description) {
		return issue;
	}
	const description = issue.description
		.replace(/<[^>]+>/g, ' ')
		.replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
		.replace(/blob:[^\s)]+/g, ' ')
		.replace(/\s+/g, ' ')
		.trim()
		.slice(0, DESCRIPTION_LIMIT);
	return {
		...issue,
		description,
	};
}
