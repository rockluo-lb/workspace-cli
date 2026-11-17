import type { ProjectRules } from '../repo/project-rules.js';
import type {
	BriefRole,
	ExecutionPlan,
	ExternalLink,
	JiraIssueContext,
	PlanStep,
	RepoContext,
} from '../shared/types.js';

export interface BriefTemplateInput {
	role: BriefRole;
	issue: JiraIssueContext;
	plan: ExecutionPlan;
	step?: PlanStep;
	links: ExternalLink[];
	repoContext: RepoContext;
	rules: ProjectRules;
	notes: string[];
	contextPath: string;
	diffRange: string;
}

const REVIEW_CHECKLIST = `- No speculative abstraction: no interface, factory, manager, wrapper, strategy, adapter, or base class for a single use case
- No unused extension points: no config flag, hook, or generic parameter that nothing uses
- Minimal diff: prefer editing existing files and deleting code over parallel code paths
- No new dependency unless nothing existing can do the job
- Scope: changes stay within the step's expected files
- Single-file size: a code file this step created or grew past the line limit must be split when it has a clear boundary (self-contained sub-component, hook, utility, type group, constant table); otherwise state why it stays
- Project rules below win over generic advice`;

function roleCard(input: BriefTemplateInput): string {
	const { role, issue, step, diffRange } = input;
	const key = issue.key;
	if (role === 'coding' && step) {
		return `You are the coding sub-agent for ${key} step ${step.id}. This brief replaces \`vibe skill\` and \`context.md\`: do not run \`vibe skill\`, and do not read other skills or rule files unless a rule listed under "Read on demand" applies to your change.

- Change only what step ${step.id} needs, within the expected files
- When done, run \`vibe code ${key} --step ${step.id}\`. It lints the files you changed. On \`VERIFY_FAILED\`, fix and rerun
- Do not run typecheck, tests, build, \`vibe code-review\`, \`vibe commit\`, or any git write command
- Look up library docs (context7 / WebSearch) only for an API this repo does not use yet
- Return: the changed files, the \`vibe code\` result, and open questions (do not guess on them)`;
	}
	return `You are the branch review sub-agent for ${key}. Review every committed step at once. Do not run \`vibe skill\`, and do not read other skills.

- Read \`git diff ${diffRange}\`
- Do not edit files, do not commit
- Return: your must-fix items, each with the file, the problem, the suggested change, and the step it belongs to (empty list when none)

Checklist:
${REVIEW_CHECKLIST}`;
}

function renderStep(step: PlanStep): string {
	const files = step.expectedFiles.map((file) => `- \`${file}\``).join('\n') || '- _none listed_';
	return `### Step ${step.id}: ${step.title}

${step.description}

Expected files:
${files}

Verify: ${step.verifyCommands.map((command) => `\`${command}\``).join(', ')}
Commit: \`${step.commitMessage}\``;
}

function renderRules(rules: ProjectRules): string {
	const sections: string[] = [];
	if (rules.agentsMd) {
		sections.push(`### AGENTS.md\n\n${rules.agentsMd}`);
	}
	for (const rule of rules.applied) {
		sections.push(`### ${rule.file}\n\n${rule.content}`);
	}
	if (rules.onDemand.length > 0) {
		const list = rules.onDemand
			.map((rule) => `- \`${rule.file}\`${rule.description ? `: ${rule.description}` : ''}`)
			.join('\n');
		sections.push(`### Read on demand\n\nOpen one of these only when your change touches its topic:\n\n${list}`);
	}
	return sections.join('\n\n') || '_No project rules found._';
}

export function renderBrief(input: BriefTemplateInput): string {
	const { role, issue, plan, step, links, repoContext, rules, notes, contextPath } = input;
	const title = step ? `${role} brief: ${issue.key} step ${step.id}` : `${role} brief: ${issue.key}`;
	const criteria = issue.acceptanceCriteria.map((item) => `- ${item}`).join('\n') || '- _none_';
	const decisions =
		(plan.decisions ?? []).map((item) => `- ${item.question}\n  - ${item.answer}`).join('\n') || '- _none_';
	const conventions = repoContext.conventions;
	const conventionLines = [
		`- Package manager: ${repoContext.packageManager}`,
		repoContext.uiFramework ? `- UI framework: ${repoContext.uiFramework}` : undefined,
		conventions ? `- Lint tools: ${conventions.lintTools.join(', ') || 'none'}` : undefined,
		conventions?.tsStrict !== undefined ? `- TypeScript strict: ${conventions.tsStrict}` : undefined,
	]
		.filter((line): line is string => line !== undefined)
		.join('\n');
	const linkList =
		links.map((link) => `- ${link.type}: ${link.url}${link.title ? ` (${link.title})` : ''}`).join('\n') ||
		'- _none_';
	const stepSection = step ? renderStep(step) : plan.steps.map(renderStep).join('\n\n');

	return `# ${title}

## Your role

${roleCard(input)}

## Task

${issue.key}: ${issue.summary}

Acceptance criteria:
${criteria}

## ${step ? 'Step' : 'Steps'}

${stepSection}

## Decisions already made

Do not reopen these.

${decisions}

## Lead notes

${notes.map((note) => `- ${note}`).join('\n') || '- _none_'}

## Project rules

${renderRules(rules)}

## Conventions

${conventionLines}

## References

Open only when the step needs details that are not in this brief.

- Full context: \`${contextPath}\`
${linkList}
`;
}
