import { renderPlanMarkdown } from "../templates/plan-template.js";
import { AIPlanInput, AIProvider, ExecutionPlan, PlanStep, VibeConfig } from "../shared/types.js";
import { renderBranchName, renderCommitMessage } from "../shared/validation.js";

function normalizeStep(
  jiraKey: string,
  config: VibeConfig,
  step: Partial<PlanStep>,
  index: number,
): PlanStep {
  const title = step.title?.trim() || `Step ${index + 1}`;
  const commitBody = step.commitMessage?.replace(/^feat\(CRMCN-\d+\):\s*/, "") || title.toLowerCase();
  return {
    id: index + 1,
    title,
    description: step.description?.trim() || `Implement ${title}.`,
    rationale: step.rationale,
    expectedFiles: (step.expectedFiles ?? []).slice(0, config.planning.maxFilesPerStep),
    verifyCommands: step.verifyCommands && step.verifyCommands.length > 0 ? step.verifyCommands : config.verify.stepCommands,
    commitMessage: renderCommitMessage(jiraKey, commitBody, config.commitPattern),
    status: "pending",
  };
}

export class DefaultPlanner {
  constructor(private readonly aiProvider: AIProvider, private readonly config: VibeConfig) {}

  async generate(params: AIPlanInput & { jiraKey: string }): Promise<ExecutionPlan> {
    const draft = await this.aiProvider.generatePlan(params);
    const rawSteps = draft.steps.slice(0, this.config.planning.maxSteps);
    while (rawSteps.length < this.config.planning.minSteps) {
      rawSteps.push({
        title: `Additional step ${rawSteps.length + 1}`,
        description: "Fill the remaining scoped work for this task.",
      });
    }

    const steps = rawSteps.map((step, index) => normalizeStep(params.jiraKey, this.config, step, index));
    return {
      jiraKey: params.jiraKey,
      branch: renderBranchName(params.jiraKey, this.config.branchPattern),
      summary: draft.summary ?? `Execution plan for ${params.issue.summary}`,
      assumptions: draft.assumptions ?? [],
      risks: draft.risks ?? [],
      steps,
    };
  }

  render(plan: ExecutionPlan): string {
    return renderPlanMarkdown(plan);
  }
}
