import fs from "fs-extra";
import path from "node:path";
import { AIProvider, ExecuteStepInput, ExecuteStepResult, VerifyService } from "../shared/types.js";

export class DefaultStepExecutor {
  constructor(
    private readonly rootDir: string,
    private readonly aiProvider: AIProvider,
    private readonly verifyService: VerifyService,
  ) {}

  async execute(input: ExecuteStepInput): Promise<ExecuteStepResult> {
    const fileSummaries = await Promise.all(
      input.step.expectedFiles.slice(0, input.maxFiles ?? 6).map(async (filePath) => {
        const absolutePath = path.join(this.rootDir, filePath);
        const exists = await fs.pathExists(absolutePath);
        const excerpt = exists ? (await fs.readFile(absolutePath, "utf8")).slice(0, 200) : "File does not exist yet.";
        return {
          path: filePath,
          excerpt: excerpt.replace(/\s+/g, " ").trim(),
        };
      }),
    );

    const draft = await this.aiProvider.prepareStepExecution({
      jiraKey: input.jiraKey,
      step: input.step,
      repoContext: input.repoContext,
      fileSummaries,
      dryRun: input.dryRun,
    });

    const verifyCommands = draft.verifyCommands && draft.verifyCommands.length > 0
      ? draft.verifyCommands
      : input.step.verifyCommands;
    const verifyResults = input.dryRun ? [] : await this.verifyService.run(verifyCommands);

    return {
      changedFiles: input.step.expectedFiles,
      summary: draft.summary,
      warnings: draft.warnings,
      verifyResults,
    };
  }
}
