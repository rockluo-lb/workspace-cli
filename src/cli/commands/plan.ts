import { Command } from "commander";
import { AppContext, printValue } from "../runtime.js";

export function registerPlanCommand(program: Command, getApp: () => Promise<AppContext>): void {
  program
    .command("plan")
    .argument("<jiraKey>")
    .description("Generate a step-by-step execution plan")
    .action(async (jiraKey: string) => {
      const app = await getApp();
      const result = await app.orchestrator.generatePlan(jiraKey);
      printValue("Generate Plan", result);
    });
}
