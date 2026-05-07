import { AppError } from './errors.js';

export const JIRA_KEY_PATTERN = /^CRMCN-\d+$/;
export const BRANCH_PATTERN = /^feat\/CRMCN-\d+$/;
export const COMMIT_PATTERN = /^(feat|refactor|fix|style)\(CRMCN-\d+\): .+$/;

export function assertValidJiraKey(jiraKey: string): void {
	if (!JIRA_KEY_PATTERN.test(jiraKey)) {
		throw new AppError('INVALID_JIRA_KEY', `Invalid Jira key: ${jiraKey}`);
	}
}

export function assertValidBranch(branchName: string): void {
	if (!BRANCH_PATTERN.test(branchName)) {
		throw new AppError('STATE_CORRUPTED', `Invalid branch name: ${branchName}`);
	}
}

export function assertValidCommitMessage(message: string): void {
	if (!COMMIT_PATTERN.test(message)) {
		throw new AppError('STATE_CORRUPTED', `Invalid commit message: ${message}`);
	}
}

export function renderBranchName(jiraKey: string, pattern: string): string {
	return pattern.replace('{jiraKey}', jiraKey);
}

export function renderCommitMessage(jiraKey: string, message: string, pattern: string): string {
	return pattern.replace('{jiraKey}', jiraKey).replace('{message}', message);
}
