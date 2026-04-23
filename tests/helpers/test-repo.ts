import { execFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import fs from "fs-extra";
import { defaultConfig } from "../../src/core/shared/config.js";
import { VibeConfig } from "../../src/core/shared/types.js";

export async function createTempRepo(overrides?: Partial<VibeConfig>): Promise<string> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), "vibe-flow-cli-"));
  execFileSync("git", ["init", "-b", "main"], { cwd: rootDir });
  execFileSync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir });
  execFileSync("git", ["config", "user.name", "Test User"], { cwd: rootDir });

  await fs.ensureDir(path.join(rootDir, ".vibe"));
  const config: VibeConfig = {
    ...defaultConfig,
    ...overrides,
    github: {
      ...defaultConfig.github,
      repository: "lifebyte-systems/TMGM-CRM-Back-End",
      ...overrides?.github,
    },
    verify: {
      stepCommands: ["git status --short"],
      taskCommands: ["git status --short"],
      ...overrides?.verify,
    },
  };
  await fs.writeJson(path.join(rootDir, ".vibe", "config.json"), config, { spaces: 2 });
  await fs.writeFile(path.join(rootDir, ".gitignore"), ".vibe/\n", "utf8");
  await fs.writeFile(path.join(rootDir, "README.md"), "# Temp Repo\n", "utf8");

  execFileSync("git", ["add", "."], { cwd: rootDir });
  execFileSync("git", ["commit", "-m", "chore: init"], { cwd: rootDir });
  return rootDir;
}
