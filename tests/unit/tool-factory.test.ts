import { afterEach, describe, expect, it } from 'vitest';
import type { VibeConfig } from '../../src/core/shared/types.js';
import { defaultConfig } from '../../src/core/shared/config.js';
import { resolveJiraProviderOrder } from '../../src/core/tools/tool-factory.js';

function createConfig(overrides?: Partial<VibeConfig>): VibeConfig {
	return {
		...defaultConfig,
		...overrides,
		jira: {
			...defaultConfig.jira,
			...overrides?.jira,
		},
		figma: {
			...defaultConfig.figma,
			...overrides?.figma,
		},
		github: {
			...defaultConfig.github,
			...overrides?.github,
		},
		planning: {
			...defaultConfig.planning,
			...overrides?.planning,
		},
		verify: {
			...defaultConfig.verify,
			...overrides?.verify,
		},
	};
}

describe('tool factory', () => {
	afterEach(() => {
		delete process.env.VIBE_USE_JIRA_PLUGIN;
		delete process.env.VIBE_USE_JIRA_MCP;
	});

	it('prefers mcp first in auto mode', () => {
		const order = resolveJiraProviderOrder(createConfig());
		expect(order).toEqual(['atlassian-mcp', 'atlassian-plugin']);
	});

	it('respects explicit jira provider and fallback', () => {
		const order = resolveJiraProviderOrder(
			createConfig({
				jira: {
					provider: 'atlassian-plugin',
					fallbackProvider: 'atlassian-mcp',
					allowedPrefixes: ['CRMCN'],
				},
			})
		);
		expect(order).toEqual(['atlassian-plugin', 'atlassian-mcp']);
	});

	it('allows environment override to prefer plugin', () => {
		process.env.VIBE_USE_JIRA_PLUGIN = '1';
		const order = resolveJiraProviderOrder(createConfig());
		expect(order).toEqual(['atlassian-plugin', 'atlassian-mcp']);
	});
});
