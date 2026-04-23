import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import type { VibeConfig } from './types.js';

const REPOSITORY_REVIEWER_PRESETS: Record<string, string[]> = {
	'lifebyte-systems/CRM-Sales-Frontend': ['jynxioxiao-lb', 'colinchen-lb'],
};

function resolveRepositoryReviewers(repository?: string, reviewers?: string[]): string[] | undefined {
	if (reviewers !== undefined) {
		return reviewers;
	}

	if (!repository) {
		return undefined;
	}

	return REPOSITORY_REVIEWER_PRESETS[repository];
}

const configSchema = z.object({
	branchPattern: z.string().default('feat/{jiraKey}'),
	commitPattern: z.string().default('feat({jiraKey}): {message}'),
	baseBranch: z.string().default('main'),
	jira: z.object({
		provider: z.enum(['auto', 'atlassian-mcp', 'atlassian-plugin']).default('auto'),
		fallbackProvider: z.enum(['atlassian-mcp', 'atlassian-plugin']).optional(),
		allowedPrefixes: z.array(z.string()).default(['CRMCN']),
	}),
	figma: z.object({
		provider: z.enum(['figma-mcp', 'figma-plugin']).default('figma-mcp'),
		fallbackProvider: z.enum(['figma-mcp', 'figma-plugin']).optional(),
	}),
	github: z.object({
		provider: z.enum(['github-mcp', 'github-plugin']).default('github-mcp'),
		fallbackProvider: z.enum(['github-mcp', 'github-plugin']).optional(),
		repository: z.string().optional(),
		reviewers: z.array(z.string()).optional(),
	}),
	planning: z.object({
		minSteps: z.number().int().min(1).default(3),
		maxSteps: z.number().int().min(1).default(7),
		maxFilesPerStep: z.number().int().min(1).default(6),
	}),
	verify: z.object({
		stepCommands: z.array(z.string()).default(['pnpm lint']),
		taskCommands: z.array(z.string()).default(['pnpm lint', 'pnpm typecheck', 'pnpm test --changed']),
	}),
});

export const defaultConfig: VibeConfig = configSchema.parse({
	jira: { fallbackProvider: 'atlassian-plugin' },
	figma: {},
	github: {},
	planning: {},
	verify: {},
});

export function getConfigPath(rootDir: string): string {
	return path.join(rootDir, '.vibe', 'config.json');
}

export async function loadOrCreateConfig(rootDir: string): Promise<VibeConfig> {
	const configPath = getConfigPath(rootDir);
	await fs.ensureDir(path.dirname(configPath));

	if (!(await fs.pathExists(configPath))) {
		await fs.writeJson(configPath, defaultConfig, { spaces: 2 });
		return defaultConfig;
	}

	const raw = await fs.readJson(configPath);
	const merged = configSchema.parse({
		...defaultConfig,
		...raw,
		jira: { ...defaultConfig.jira, ...raw.jira },
		figma: { ...defaultConfig.figma, ...raw.figma },
		github: {
			...defaultConfig.github,
			...raw.github,
			reviewers: resolveRepositoryReviewers(raw.github?.repository, raw.github?.reviewers),
		},
		planning: { ...defaultConfig.planning, ...raw.planning },
		verify: { ...defaultConfig.verify, ...raw.verify },
	});

	await fs.writeJson(configPath, merged, { spaces: 2 });
	return merged;
}
