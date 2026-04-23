import { VibeConfig } from "../shared/types.js";
import { DefaultExternalToolAdapter } from "./external-tool-adapter.js";
import { FigmaMcpProvider } from "./figma/figma-mcp-provider.js";
import { FigmaPluginProvider } from "./figma/figma-plugin-provider.js";
import { GitHubMcpProvider } from "./github/github-mcp-provider.js";
import { GitHubPluginProvider } from "./github/github-plugin-provider.js";
import { AtlassianPluginProvider } from "./jira/atlassian-plugin-provider.js";

export function createExternalToolAdapter(_config: VibeConfig): DefaultExternalToolAdapter {
  return new DefaultExternalToolAdapter(
    new AtlassianPluginProvider(),
    process.env.VIBE_USE_FIGMA_PLUGIN === "1" ? new FigmaPluginProvider() : new FigmaMcpProvider(),
    process.env.VIBE_USE_GITHUB_PLUGIN === "1" ? new GitHubPluginProvider() : new GitHubMcpProvider(),
  );
}
