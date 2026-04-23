import { Command } from "commander";
import { AppContext, printValue } from "../runtime.js";

export function registerContextCommand(program: Command, getApp: () => Promise<AppContext>): void {
  program
    .command("context")
    .argument("<jiraKey>")
    .description("Build design and repository context for a task")
    .action(async (jiraKey: string) => {
      const app = await getApp();
      const result = await app.orchestrator.buildContext(jiraKey);
      printValue("Build Context", result);
    });
}
