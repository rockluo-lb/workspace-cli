import { exec } from "node:child_process";
import { promisify } from "node:util";
import { CommandResult, VerifyService } from "../shared/types.js";

const execAsync = promisify(exec);

export class ShellVerifyService implements VerifyService {
  constructor(private readonly rootDir: string) {}

  async run(commands: string[]): Promise<CommandResult[]> {
    const results: CommandResult[] = [];

    for (const command of commands) {
      try {
        const outcome = await execAsync(command, {
          cwd: this.rootDir,
          shell: "/bin/zsh",
        });
        results.push({
          command,
          code: 0,
          stdout: outcome.stdout,
          stderr: outcome.stderr,
        });
      } catch (error) {
        const failure = error as NodeJS.ErrnoException & {
          code?: number | string;
          stdout?: string;
          stderr?: string;
        };
        results.push({
          command,
          code: typeof failure.code === "number" ? failure.code : 1,
          stdout: failure.stdout ?? "",
          stderr: failure.stderr ?? failure.message,
        });
      }
    }

    return results;
  }
}
