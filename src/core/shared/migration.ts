export const MIGRATION_TEXT = /搬移|搬到|迁移到|旧项目|功能迁移|legacy project/i;

export function isMigrationText(text: string): boolean {
	return MIGRATION_TEXT.test(text);
}

export function issuePlainText(issue: { summary: string; description?: string }): string {
	return `${issue.summary}\n${issue.description ?? ''}`;
}

export function parityChecklistTemplate(jiraKey: string, targetRoot: string, sourceRoot?: string): string {
	return `# ${jiraKey} parity checklist

- Target repository: \`${targetRoot}\`
- Source repository: \`${sourceRoot ?? 'not set'}\`

| Capability | Legacy location | Target location | Kind | Evidence | Status |
| --- | --- | --- | --- | --- | --- |
| | | | keep / intentional / refactor / missing | | TODO |

Kind is one of: keep, intentional, refactor, missing.
Do not mark a row done when the only evidence is mock data.
`;
}
