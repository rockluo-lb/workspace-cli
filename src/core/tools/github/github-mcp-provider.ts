import {
  GitHubCodeSearchResult,
  GitHubPRContext,
  GitHubProvider,
  GitHubRepoContext,
  PRContext,
} from "../../shared/types.js";
import { loadFixtureMap } from "../provider-utils.js";

export class GitHubMcpProvider implements GitHubProvider {
  async getRepositoryMeta(repositoryFullName: string): Promise<GitHubRepoContext> {
    const fixtures = await loadFixtureMap<GitHubRepoContext>("VIBE_GITHUB_REPO_FIXTURES");
    return fixtures?.[repositoryFullName] ?? {
      fullName: repositoryFullName,
      defaultBranch: "main",
      languages: ["TypeScript"],
      topics: ["crm", "workflow"],
      description: "Synthetic repository context",
    };
  }

  async searchCode(repositoryFullName: string, query: string): Promise<GitHubCodeSearchResult[]> {
    const fixtures = await loadFixtureMap<GitHubCodeSearchResult[]>("VIBE_GITHUB_CODE_FIXTURES");
    return fixtures?.[`${repositoryFullName}:${query}`] ?? [];
  }

  async getRecentRelatedPRs(repositoryFullName: string, jiraKey: string): Promise<GitHubPRContext[]> {
    const fixtures = await loadFixtureMap<GitHubPRContext[]>("VIBE_GITHUB_PR_FIXTURES");
    return fixtures?.[`${repositoryFullName}:${jiraKey}`] ?? [];
  }

  async preparePRContext(repositoryFullName: string, branchName: string): Promise<PRContext> {
    const relatedPRs = await this.getRecentRelatedPRs(repositoryFullName, branchName);
    return {
      repositoryFullName,
      branchName,
      compareUrl: `https://github.com/${repositoryFullName}/compare/${branchName}`,
      relatedPRs,
    };
  }
}
