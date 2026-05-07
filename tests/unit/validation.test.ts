import { describe, expect, it } from 'vitest';
import {
	assertValidBranch,
	assertValidCommitMessage,
	assertValidJiraKey,
	BRANCH_PATTERN,
	COMMIT_PATTERN,
	JIRA_KEY_PATTERN,
	renderBranchName,
	renderCommitMessage,
} from '../../src/core/shared/validation.js';

describe('validation rules', () => {
	it('accepts valid Jira keys', () => {
		expect(JIRA_KEY_PATTERN.test('CRMCN-1234')).toBe(true);
		expect(() => assertValidJiraKey('CRMCN-1234')).not.toThrow();
	});

	it('accepts valid branch and commit formats', () => {
		expect(BRANCH_PATTERN.test('feat/CRMCN-1234')).toBe(true);
		expect(COMMIT_PATTERN.test('feat(CRMCN-1234): wire filters')).toBe(true);
		expect(() => assertValidBranch('feat/CRMCN-1234')).not.toThrow();
		expect(() => assertValidCommitMessage('feat(CRMCN-1234): wire filters')).not.toThrow();
	});

	it('accepts refactor, fix, and style commit prefixes', () => {
		expect(COMMIT_PATTERN.test('refactor(CRMCN-1234): split details into folder')).toBe(true);
		expect(COMMIT_PATTERN.test('fix(CRMCN-1234): correct filter logic')).toBe(true);
		expect(COMMIT_PATTERN.test('style(CRMCN-1234): format code')).toBe(true);
		expect(() => assertValidCommitMessage('refactor(CRMCN-1234): split details into folder')).not.toThrow();
		expect(() => assertValidCommitMessage('fix(CRMCN-1234): correct filter logic')).not.toThrow();
		expect(() => assertValidCommitMessage('style(CRMCN-1234): format code')).not.toThrow();
	});

	it('rejects unsupported commit prefixes', () => {
		expect(COMMIT_PATTERN.test('chore(CRMCN-1234): update deps')).toBe(false);
		expect(COMMIT_PATTERN.test('docs(CRMCN-1234): add readme')).toBe(false);
		expect(() => assertValidCommitMessage('chore(CRMCN-1234): update deps')).toThrow();
	});

	it('renders templates', () => {
		expect(renderBranchName('CRMCN-55', 'feat/{jiraKey}')).toBe('feat/CRMCN-55');
		expect(renderCommitMessage('CRMCN-55', 'wire filters', 'feat({jiraKey}): {message}')).toBe(
			'feat(CRMCN-55): wire filters'
		);
	});
});
