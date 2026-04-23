import fs from "fs-extra";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { SimpleGitService } from "../../src/core/git/local-git-service.js";
import { AppError } from "../../src/core/shared/errors.js";
import { createTempDir, initGitRepo } from "../helpers/test-env.js";

describe("git service", () => {
  it("shows dirty files in the clean worktree error", async () => {
    const rootDir = await createTempDir("vibe-git-service-");
    await initGitRepo(rootDir);
    await fs.writeFile(path.join(rootDir, "dirty.txt"), "x", "utf8");

    const service = new SimpleGitService(rootDir);

    await expect(service.ensureCleanWorktree()).rejects.toMatchObject({
      code: "GIT_DIRTY_WORKTREE",
    });

    try {
      await service.ensureCleanWorktree();
    } catch (error) {
      expect((error as Error).message).toContain("dirty.txt");
      expect((error as Error).message).toContain("Commit, stash, or discard");
    }
  });
});
