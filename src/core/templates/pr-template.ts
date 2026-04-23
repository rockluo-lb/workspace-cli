import type { PRBuildInput } from '../shared/types.js';

export function renderPrMarkdown(input: PRBuildInput): string {
	const links =
		input.links.length > 0
			? input.links.map((link) => `- [${link.title ?? link.type}](${link.url})`).join('\n')
			: '- None';
	const steps = input.plan.steps.map((step) => `- Step ${step.id}: ${step.title} (\`${step.status}\`)`).join('\n');
	const commits =
		input.progress.commits.length > 0
			? input.progress.commits
					.map((commit) => `- Step ${commit.step}: \`${commit.sha}\` ${commit.message}`)
					.join('\n')
			: '- None';
	const verify =
		input.verifyResults && input.verifyResults.length > 0
			? input.verifyResults
					.map(
						(result) => `- \`${result.command}\` => ${result.code === 0 ? 'pass' : `fail (${result.code})`}`
					)
					.join('\n')
			: '- Not run';

	return `# ${input.issue.summary}

Jira: \`${input.issue.key}\`

## Summary
${input.plan.summary}

## Links
${links}

## Steps
${steps}

## Commits
${commits}

## Verification
${verify}

## PR Context
- Repository: ${input.prContext?.repositoryFullName ?? 'unknown'}
- Branch: ${input.prContext?.branchName ?? input.plan.branch}
- Compare: ${input.prContext?.compareUrl ?? 'n/a'}
`;
}
