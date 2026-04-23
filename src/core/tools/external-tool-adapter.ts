import { ExternalToolAdapter, FigmaProvider, GitHubProvider, JiraProvider } from "../shared/types.js";

export class DefaultExternalToolAdapter implements ExternalToolAdapter {
  constructor(
    readonly jira: JiraProvider,
    readonly figma: FigmaProvider,
    readonly github: GitHubProvider,
  ) {}
}
