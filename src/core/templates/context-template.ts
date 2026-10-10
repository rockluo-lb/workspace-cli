import type { ConfluencePageContext, FigmaDesignContext, JiraIssueContext, RepoContext } from '../shared/types.js';

export function renderContextMarkdown(input: {
	issue: JiraIssueContext;
	repoContext: RepoContext;
	figmaContexts: FigmaDesignContext[];
	confluencePages: ConfluencePageContext[];
}): string {
	const figma =
		input.figmaContexts.length > 0
			? input.figmaContexts
					.map((item) => {
						const texts = item.texts
							.slice(0, 12)
							.map((text) => text.replace(/\s+/g, ' ').trim().slice(0, 160))
							.filter((text) => text.length > 0);
						const partial = item.partial ? ' (partial — split into child frames before implementing)' : '';
						const preview = texts.length > 0 ? `: ${texts.join(' | ')}` : '';
						return `- ${item.title ?? item.nodeName ?? 'Untitled'}${partial}${preview}`;
					})
					.join('\n')
			: '- None';
	const confluence =
		input.confluencePages.length > 0
			? input.confluencePages.map((page) => `- [${page.title ?? page.url}](${page.url})`).join('\n')
			: '- None';

	const conventions = input.repoContext.conventions;
	const conventionLines = conventions
		? [
				`- Cursor Rules: ${conventions.cursorRules.join(', ') || 'none'}`,
				`- AGENTS.md: ${conventions.hasAgentsMd ? 'present' : 'absent'}`,
				`- Lint Tools: ${conventions.lintTools.join(', ') || 'none'}`,
				`- TS Strict: ${conventions.tsStrict === undefined ? 'unknown' : conventions.tsStrict}`,
				`- Scripts: ${conventions.scripts.join(', ') || 'none'}`,
			].join('\n')
		: '- Not collected';

	return `# Context for ${input.issue.key}

## Issue
- Summary: ${input.issue.summary}
- Labels: ${input.issue.labels.join(', ') || 'none'}
- Acceptance Criteria: ${input.issue.acceptanceCriteria.join('; ') || 'none'}

## Repo Context
- Repo: ${input.repoContext.repoName}
- Package Manager: ${input.repoContext.packageManager}
- Workspace: ${input.repoContext.workspaceType}
- UI: ${input.repoContext.uiFramework ?? 'unknown'}
- Tests: ${input.repoContext.testTools.join(', ') || 'none'}

## Conventions
${conventionLines}

## Figma
${figma}

## Confluence
${confluence}
`;
}
