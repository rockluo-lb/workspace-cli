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
					.map((item) => `- ${item.title ?? item.nodeName ?? 'Untitled'}${item.partial ? ' (partial)' : ''}`)
					.join('\n')
			: '- None';
	const confluence =
		input.confluencePages.length > 0
			? input.confluencePages.map((page) => `- [${page.title ?? page.url}](${page.url})`).join('\n')
			: '- None';

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

## Figma
${figma}

## Confluence
${confluence}
`;
}
