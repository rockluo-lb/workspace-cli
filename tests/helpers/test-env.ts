import fs from "fs-extra";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";

export async function createTempDir(prefix: string): Promise<string> {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

export function run(command: string, args: string[], cwd: string): string {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });

  if (result.status !== 0) {
    throw new Error(`Command failed: ${command} ${args.join(" ")}\n${result.stderr}`);
  }

  return result.stdout.trim();
}

export async function initGitRepo(rootDir: string): Promise<void> {
  await fs.writeFile(path.join(rootDir, ".gitignore"), ".vibe/\n", "utf8");
  await fs.writeFile(path.join(rootDir, "README.md"), "# Test Repo\n", "utf8");
  run("git", ["init", "-b", "main"], rootDir);
  run("git", ["config", "user.email", "test@example.com"], rootDir);
  run("git", ["config", "user.name", "Test User"], rootDir);
  run("git", ["add", "."], rootDir);
  run("git", ["commit", "-m", "chore: initial"], rootDir);
}
