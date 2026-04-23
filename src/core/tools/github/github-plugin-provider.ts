import { CapabilityUnavailableError } from "../../shared/errors.js";
import {
  GitHubCodeSearchResult,
  GitHubPRContext,
  GitHubProvider,
  GitHubRepoContext,
  PRContext,
} from "../../shared/types.js";

export class GitHubPluginProvider implements GitHubProvider {
  async getRepositoryMeta(_repositoryFullName: string): Promise<GitHubRepoContext> {
    throw new CapabilityUnavailableError("GitHub plugin provider is not implemented in the MVP.");
  }

  async searchCode(_repositoryFullName: string, _query: string): Promise<GitHubCodeSearchResult[]> {
    throw new CapabilityUnavailableError("GitHub plugin provider is not implemented in the MVP.");
  }

  async getRecentRelatedPRs(_repositoryFullName: string, _jiraKey: string): Promise<GitHubPRContext[]> {
    throw new CapabilityUnavailableError("GitHub plugin provider is not implemented in the MVP.");
  }

  async preparePRContext(_repositoryFullName: string, _branchName: string): Promise<PRContext> {
    throw new CapabilityUnavailableError("GitHub plugin provider is not implemented in the MVP.");
  }
}
