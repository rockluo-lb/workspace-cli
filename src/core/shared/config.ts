import fs from 'fs-extra';
import path from 'node:path';
import { z } from 'zod';
import { resolveWorkspaceStateDir } from './state-paths.js';
import type { VibeConfig } from './types.js';

const VERIFY_SCRIPT_PRIORITY = ['lint:ts', 'lint:js:check', 'lint:css:check', 'typecheck', 'specs:check', 'test', 'build'];
const ESLINT_RUNNERS = { npm: 'npx eslint', yarn: 'yarn eslint', pnpm: 'pnpm exec eslint' } as const;

export async function inferProjectDefaults(rootDir: string): Promise<{
	verify?: VibeConfig['verify'];
}> {
	const packageJsonPath = path.join(rootDir, 'package.json');
	let verify: VibeConfig['verify'] | undefined;
	if (await fs.pathExists(packageJsonPath)) {
		const packageJson = (await fs.readJson(packageJsonPath)) as {
			scripts?: Record<string, string>;
			dependencies?: Record<string, string>;
			devDependencies?: Record<string, string>;
		};
		const scripts = Object.keys(packageJson.scripts ?? {});
		const selected = VERIFY_SCRIPT_PRIORITY.filter((name) => scripts.includes(name));
		if (selected.length > 0) {
			const packageManager = (await fs.pathExists(path.join(rootDir, 'package-lock.json')))
				? 'npm'
				: (await fs.pathExists(path.join(rootDir, 'yarn.lock')))
					? 'yarn'
					: 'pnpm';
			const hasEslint = Boolean(packageJson.devDependencies?.eslint ?? packageJson.dependencies?.eslint);
			const stepNames = selected.filter((name) => name.startsWith('lint') || name === 'typecheck');
			verify = {
				stepCommands: hasEslint
					? [`${ESLINT_RUNNERS[packageManager]} {files}`]
					: (stepNames.length > 0 ? stepNames : selected.slice(0, 1)).map((name) => `${packageManager} ${name}`),
				taskCommands: selected.map((name) => `${packageManager} ${name}`),
			};
		}
	}

	return { verify };
}

const configSchema = z.object({
	branchPattern: z.string().default('feat/{jiraKey}'),
	commitPattern: z.string().default('feat({jiraKey}): {message}'),
	baseBranch: z.string().default('main'),
	jira: z.object({
		provider: z.enum(['auto', 'atlassian-mcp', 'atlassian-plugin']).default('auto'),
		fallbackProvider: z.enum(['atlassian-mcp', 'atlassian-plugin']).optional(),
		allowedPrefixes: z.array(z.string()).default([]),
	}),
	figma: z.object({
		provider: z.enum(['figma-mcp', 'figma-plugin']).default('figma-mcp'),
		fallbackProvider: z.enum(['figma-mcp', 'figma-plugin']).optional(),
	}),
	github: z.object({
		provider: z.enum(['github-mcp', 'github-plugin']).default('github-mcp'),
		fallbackProvider: z.enum(['github-mcp', 'github-plugin']).optional(),
		repository: z.string().optional(),
	}),
	pr: z.object({
		aiDisclosure: z
			.string()
			.default(
				'> This PR draft was generated with vibe-cli AI assistance. Please review all changes carefully before merging.'
			),
	}),
	planning: z.object({
		minSteps: z.number().int().min(1).default(3),
		maxSteps: z.number().int().min(1).default(7),
		maxFilesPerStep: z.number().int().min(1).default(12),
	}),
	verify: z.object({
		stepCommands: z.array(z.string()).default(['pnpm lint']),
		taskCommands: z.array(z.string()).default(['pnpm lint', 'pnpm typecheck', 'pnpm test --changed']),
	}),
	review: z.object({
		uncertaintyThreshold: z.number().min(0).max(1).default(0.2),
		maxIterations: z.number().int().min(1).default(3),
	}),
	codeReview: z.object({
		riskThreshold: z.number().min(0).max(1).default(0.25),
		maxIterations: z.number().int().min(1).default(3),
		maxInsertions: z.number().int().min(1).default(1000),
		maxFileLines: z.number().int().min(1).default(300),
	}),
});

export const defaultConfig: VibeConfig = configSchema.parse({
	jira: { fallbackProvider: 'atlassian-plugin' },
	figma: {},
	github: {},
	pr: {},
	planning: {},
	verify: {},
	review: {},
	codeReview: {},
});

export function getConfigPath(rootDir: string, stateRoot = resolveWorkspaceStateDir(rootDir)): string {
	return path.join(stateRoot, 'config.json');
}

export async function loadOrCreateConfig(rootDir: string, stateRoot = resolveWorkspaceStateDir(rootDir)): Promise<VibeConfig> {
	const configPath = getConfigPath(rootDir, stateRoot);
	await fs.ensureDir(path.dirname(configPath));

	if (!(await fs.pathExists(configPath))) {
		const inferred = await inferProjectDefaults(rootDir);
		const created = configSchema.parse({
			...defaultConfig,
			verify: inferred.verify ?? defaultConfig.verify,
		});
		await fs.writeJson(configPath, created, { spaces: 2 });
		return created;
	}

	const raw = await fs.readJson(configPath);
	const merged = configSchema.parse({
		...defaultConfig,
		...raw,
		jira: { ...defaultConfig.jira, ...raw.jira },
		figma: { ...defaultConfig.figma, ...raw.figma },
		github: { ...defaultConfig.github, ...raw.github },
		pr: { ...defaultConfig.pr, ...raw.pr },
		planning: { ...defaultConfig.planning, ...raw.planning },
		verify: { ...defaultConfig.verify, ...raw.verify },
		review: { ...defaultConfig.review, ...raw.review },
		codeReview: { ...defaultConfig.codeReview, ...raw.codeReview },
	});

	await fs.writeJson(configPath, merged, { spaces: 2 });
	return merged;
}
