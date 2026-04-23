import path from "node:path";
import { simpleGit, type SimpleGit } from "simple-git";
import { AppError } from "../shared/errors.js";
import { LocalGitService } from "../shared/types.js";

function isOperationalFile(file: string): boolean {
  return file.replace(/\\/g, "/").startsWith(".vibe/");
}

function formatDirtyWorktreeMessage(files: string[]): string {
  const preview = files.slice(0, 8).map((file) => `- ${file}`).join("\n");
  const suffix = files.length > 8 ? `\n- ...and ${files.length - 8} more` : "";
  return [
    "Git worktree must be clean before starting a task.",
    "",
    "Dirty files:",
    preview,
    suffix,
    "",
    "Commit, stash, or discard these changes before running `vibe start`.",
  ].join("\n");
}

export class SimpleGitService implements LocalGitService {
  private readonly git: SimpleGit;

  constructor(private readonly rootDir: string) {
    this.git = simpleGit(rootDir);
  }

  async ensureCleanWorktree(): Promise<void> {
    const status = await this.git.status();
    const files = [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.not_added,
      ...status.staged,
      ...status.renamed.map((entry) => entry.to),
    ].filter((file) => !isOperationalFile(file));
    if (files.length > 0) {
      throw new AppError("GIT_DIRTY_WORKTREE", formatDirtyWorktreeMessage(files));
    }
  }

  async checkoutBaseBranch(baseBranch: string): Promise<void> {
    await this.git.checkout(baseBranch);
  }

  async pullBaseBranch(baseBranch: string): Promise<void> {
    const remotes = await this.git.getRemotes(true);
    if (remotes.length === 0) {
      return;
    }

    await this.git.pull("origin", baseBranch);
  }

  async createBranch(branchName: string): Promise<void> {
    const branch = await this.git.branchLocal();
    if (branch.all.includes(branchName)) {
      throw new AppError("BRANCH_ALREADY_EXISTS", `Branch already exists: ${branchName}`);
    }
    await this.git.checkoutLocalBranch(branchName);
  }

  async getDiffFiles(): Promise<string[]> {
    const status = await this.git.status();
    const files = new Set<string>();
    for (const file of [
      ...status.modified,
      ...status.created,
      ...status.deleted,
      ...status.not_added,
      ...status.staged,
      ...status.renamed.map((entry) => entry.to),
    ]) {
      if (!isOperationalFile(file)) {
        files.add(path.normalize(file));
      }
    }
    return [...files];
  }

  async addFiles(files: string[]): Promise<void> {
    if (files.length === 0) {
      return;
    }
    await this.git.add(files);
  }

  async commit(message: string): Promise<string> {
    const result = await this.git.commit(message);
    return result.commit;
  }

  async getCurrentBranch(): Promise<string> {
    const branch = await this.git.branchLocal();
    return branch.current;
  }
}
