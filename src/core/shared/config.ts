import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import type { VibeConfig } from './types.js';

const configSchema = z.object({
	branchPattern: z.string().default('feat/{jiraKey}'),
	commitPattern: z.string().default('feat({jiraKey}): {message}'),
	baseBranch: z.string().default('main'),
	jira: z.object({
		provider: z.string().default('atlassian-plugin'),
		allowedPrefixes: z.array(z.string()).default(['CRMCN']),
	}),
	figma: z.object({
		provider: z.string().default('figma-mcp'),
		fallbackProvider: z.string().optional(),
	}),
	github: z.object({
		provider: z.string().default('github-mcp'),
		fallbackProvider: z.string().optional(),
		repository: z.string().optional(),
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
	jira: {},
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
		github: { ...defaultConfig.github, ...raw.github },
		planning: { ...defaultConfig.planning, ...raw.planning },
		verify: { ...defaultConfig.verify, ...raw.verify },
	});

	await fs.writeJson(configPath, merged, { spaces: 2 });
	return merged;
}
