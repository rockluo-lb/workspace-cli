import { CommandResult, PlanStep } from "../shared/types.js";

export function renderStepReport(step: PlanStep, sections: string[], verifyResults?: CommandResult[]): string {
  const verify = verifyResults && verifyResults.length > 0
    ? verifyResults.map((result) => `- \`${result.command}\`: ${result.code === 0 ? "pass" : `fail (${result.code})`}`).join("\n")
    : "- Not run";

  return `# Step ${step.id} Report

## Step
- Title: ${step.title}
- Status: ${step.status}
- Commit: \`${step.commitMessage}\`

## Notes
${sections.map((item) => `- ${item}`).join("\n")}

## Verification
${verify}
`;
}

export function renderVerifyReport(results: CommandResult[]): string {
  return `# Task Verification

${results.map((result) => `- \`${result.command}\`: ${result.code === 0 ? "pass" : `fail (${result.code})`}`).join("\n")}
`;
}
