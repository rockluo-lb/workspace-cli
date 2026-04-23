import type {
	FigmaProviderMode,
	GitHubProviderMode,
	JiraProvider,
	JiraProviderMode,
	VibeConfig,
} from '../shared/types.js';
import { DefaultExternalToolAdapter } from './external-tool-adapter.js';
import { FigmaMcpProvider } from './figma/figma-mcp-provider.js';
import { FigmaPluginProvider } from './figma/figma-plugin-provider.js';
import { GitHubMcpProvider } from './github/github-mcp-provider.js';
import { GitHubPluginProvider } from './github/github-plugin-provider.js';
import { AtlassianMcpProvider } from './jira/atlassian-mcp-provider.js';
import { AtlassianPluginProvider } from './jira/atlassian-plugin-provider.js';
import { PreferredJiraProvider } from './jira/preferred-jira-provider.js';

function dedupe<T>(items: T[]): T[] {
	return [...new Set(items)];
}

export function resolveJiraProviderOrder(config: VibeConfig): Exclude<JiraProviderMode, 'auto'>[] {
	if (process.env.VIBE_USE_JIRA_PLUGIN === '1') {
		return ['atlassian-plugin', 'atlassian-mcp'];
	}

	if (process.env.VIBE_USE_JIRA_MCP === '1') {
		return ['atlassian-mcp', 'atlassian-plugin'];
	}

	if (config.jira.provider === 'auto') {
		return dedupe(['atlassian-mcp', config.jira.fallbackProvider ?? 'atlassian-plugin']);
	}

	return dedupe([
		config.jira.provider,
		...(config.jira.fallbackProvider ? [config.jira.fallbackProvider] : []),
	]) as Exclude<JiraProviderMode, 'auto'>[];
}

function createJiraProvider(config: VibeConfig): JiraProvider {
	const providers = resolveJiraProviderOrder(config).map((provider) =>
		provider === 'atlassian-plugin' ? new AtlassianPluginProvider() : new AtlassianMcpProvider()
	);
	return new PreferredJiraProvider(providers);
}

function createFigmaProvider(config: VibeConfig) {
	const selected: FigmaProviderMode =
		process.env.VIBE_USE_FIGMA_PLUGIN === '1' ? 'figma-plugin' : config.figma.provider;
	return selected === 'figma-plugin' ? new FigmaPluginProvider() : new FigmaMcpProvider();
}

function createGitHubProvider(config: VibeConfig) {
	const selected: GitHubProviderMode =
		process.env.VIBE_USE_GITHUB_PLUGIN === '1' ? 'github-plugin' : config.github.provider;
	return selected === 'github-plugin' ? new GitHubPluginProvider() : new GitHubMcpProvider();
}

export function createExternalToolAdapter(config: VibeConfig): DefaultExternalToolAdapter {
	return new DefaultExternalToolAdapter(
		createJiraProvider(config),
		createFigmaProvider(config),
		createGitHubProvider(config)
	);
}
