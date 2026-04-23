import { ExecutionPlan } from "../shared/types.js";

export function renderPlanMarkdown(plan: ExecutionPlan): string {
  const steps = plan.steps
    .map((step) => {
      const files = step.expectedFiles.length > 0 ? step.expectedFiles.map((file) => `- \`${file}\``).join("\n") : "- _TBD_";
      const verify = step.verifyCommands.map((command) => `- \`${command}\``).join("\n");
      return `## Step ${step.id}: ${step.title}

${step.description}

Status: \`${step.status}\`

Expected files:
${files}

Verify:
${verify}

Commit:
\`${step.commitMessage}\``;
    })
    .join("\n\n");

  return `# Execution Plan for ${plan.jiraKey}

Branch: \`${plan.branch}\`

## Summary
${plan.summary}

## Assumptions
${plan.assumptions.map((item) => `- ${item}`).join("\n") || "- None"}

## Risks
${plan.risks.map((item) => `- ${item}`).join("\n") || "- None"}

${steps}
`;
}
