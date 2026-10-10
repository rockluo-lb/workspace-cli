import { AppError } from './errors.js';

const DEFAULT_PREFIXES = ['CRMCN'];
const DEFAULT_BRANCH_PATTERN = 'feat/{jiraKey}';
const COMMIT_TYPES = 'feat|refactor|fix|style';

export function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function jiraKeyPatternFor(prefixes: string[]): RegExp {
	const body = prefixes.map(escapeRegex).join('|');
	return new RegExp(`^(?:${body})-\\d+$`);
}

export function branchPatternFor(pattern: string, prefixes: string[]): RegExp {
	const [prefix = '', suffix = ''] = pattern.split('{jiraKey}');
	const key = `(?:${prefixes.map(escapeRegex).join('|')})-\\d+`;
	return new RegExp(`^${escapeRegex(prefix)}${key}${escapeRegex(suffix)}$`);
}

export function commitPatternFor(prefixes: string[]): RegExp {
	const key = `(?:${prefixes.map(escapeRegex).join('|')})-\\d+`;
	return new RegExp(`^(?:${COMMIT_TYPES})\\(${key}\\): .+$`);
}

export const JIRA_KEY_PATTERN = jiraKeyPatternFor(DEFAULT_PREFIXES);
export const BRANCH_PATTERN = branchPatternFor(DEFAULT_BRANCH_PATTERN, DEFAULT_PREFIXES);
export const COMMIT_PATTERN = commitPatternFor(DEFAULT_PREFIXES);

export function assertValidJiraKey(jiraKey: string, prefixes: string[] = DEFAULT_PREFIXES): void {
	if (!jiraKeyPatternFor(prefixes).test(jiraKey)) {
		throw new AppError(
			'INVALID_JIRA_KEY',
			`Invalid Jira key: ${jiraKey}. Allowed prefixes: ${prefixes.join(', ')}`
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
