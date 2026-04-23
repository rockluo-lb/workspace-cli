import { Command } from "commander";
import { AppContext, printValue } from "../runtime.js";

export function registerResumeCommand(program: Command, getApp: () => Promise<AppContext>): void {
  program
    .command("resume")
    .argument("<jiraKey>")
    .description("Show the next recommended action for a task")
    .action(async (jiraKey: string) => {
      const app = await getApp();
      const result = await app.orchestrator.resumeTask(jiraKey);
      printValue("Resume Task", result);
    });
}
