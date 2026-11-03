import { AppError } from './errors.js';

// No configured prefixes means any Jira-style project key is accepted.
const DEFAULT_PREFIXES: string[] = [];
const DEFAULT_BRANCH_PATTERN = 'feat/{jiraKey}';
const COMMIT_TYPES = 'feat|refactor|fix|style';

export function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function jiraKeySource(prefixes: string[]): string {
	const project = prefixes.length > 0 ? prefixes.map(escapeRegex).join('|') : '[A-Z][A-Z0-9]+';
	return `(?:${project})-\\d+`;
}

export function jiraKeyPatternFor(prefixes: string[]): RegExp {
	return new RegExp(`^${jiraKeySource(prefixes)}$`);
}

export function branchPatternFor(pattern: string, prefixes: string[]): RegExp {
	const [prefix = '', suffix = ''] = pattern.split('{jiraKey}');
	return new RegExp(`^${escapeRegex(prefix)}${jiraKeySource(prefixes)}${escapeRegex(suffix)}$`);
}

export function commitPatternFor(prefixes: string[]): RegExp {
	return new RegExp(`^(?:${COMMIT_TYPES})\\(${jiraKeySource(prefixes)}\\): .+$`);
}

export const JIRA_KEY_PATTERN = jiraKeyPatternFor(DEFAULT_PREFIXES);
export const BRANCH_PATTERN = branchPatternFor(DEFAULT_BRANCH_PATTERN, DEFAULT_PREFIXES);
export const COMMIT_PATTERN = commitPatternFor(DEFAULT_PREFIXES);

export function assertValidJiraKey(jiraKey: string, prefixes: string[] = DEFAULT_PREFIXES): void {
	if (!jiraKeyPatternFor(prefixes).test(jiraKey)) {
		throw new AppError(
			'INVALID_JIRA_KEY',
			prefixes.length > 0
				? `Invalid Jira key: ${jiraKey}. Allowed prefixes: ${prefixes.join(', ')}`
				: `Invalid Jira key: ${jiraKey}. Expected <PROJECT>-<NUMBER>, for example PROJ-123.`
		);
	}
}

export function assertValidBranch(
	branchName: string,
	pattern: string = DEFAULT_BRANCH_PATTERN,
	prefixes: string[] = DEFAULT_PREFIXES
): void {
	if (!branchPatternFor(pattern, prefixes).test(branchName)) {
		throw new AppError('STATE_CORRUPTED', `Invalid branch name: ${branchName}`);
	}
}

export function assertValidCommitMessage(message: string, prefixes: string[] = DEFAULT_PREFIXES): void {
	if (!commitPatternFor(prefixes).test(message)) {
		throw new AppError('STATE_CORRUPTED', `Invalid commit message: ${message}`);
	}
}

export function renderBranchName(jiraKey: string, pattern: string): string {
	return pattern.replace('{jiraKey}', jiraKey);
}

export function renderCommitMessage(jiraKey: string, message: string, pattern: string): string {
	return pattern.replace('{jiraKey}', jiraKey).replace('{message}', message);
}

export function commitBody(message: string | undefined, fallback: string): string {
	if (!message) {
		return fallback;
	}
	const stripped = message.replace(/^(?:feat|refactor|fix|style)\([A-Za-z][A-Za-z0-9]+-\d+\):\s*/, '').trim();
	return stripped || fallback;
}
