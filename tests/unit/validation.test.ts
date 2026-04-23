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

	it('renders templates', () => {
		expect(renderBranchName('CRMCN-55', 'feat/{jiraKey}')).toBe('feat/CRMCN-55');
		expect(renderCommitMessage('CRMCN-55', 'wire filters', 'feat({jiraKey}): {message}')).toBe(
			'feat(CRMCN-55): wire filters'
		);
	});
});
