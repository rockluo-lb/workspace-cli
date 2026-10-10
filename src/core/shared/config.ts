import fs from 'fs-extra';
import path from 'node:path';
import { simpleGit } from 'simple-git';
import { z } from 'zod';
import { resolveWorkspaceStateDir } from './state-paths.js';
import type { VibeConfig } from './types.js';

const VERIFY_SCRIPT_PRIORITY = ['lint:ts', 'lint:js:check', 'lint:css:check', 'typecheck', 'specs:check', 'build'];

export async function inferProjectDefaults(rootDir: string): Promise<{
	baseBranch?: string;
	verify?: VibeConfig['verify'];
}> {
	const packageJsonPath = path.join(rootDir, 'package.json');
	let verify: VibeConfig['verify'] | undefined;
	if (await fs.pathExists(packageJsonPath)) {
		const packageJson = (await fs.readJson(packageJsonPath)) as { scripts?: Record<string, string> };
		const scripts = Object.keys(packageJson.scripts ?? {});
		const selected = VERIFY_SCRIPT_PRIORITY.filter((name) => scripts.includes(name));
		if (selected.length > 0) {
			const packageManager = (await fs.pathExists(path.join(rootDir, 'package-lock.json')))
				? 'npm'
				: (await fs.pathExists(path.join(rootDir, 'yarn.lock')))
					? 'yarn'
					: 'pnpm';
			const stepNames = selected.filter((name) => name.startsWith('lint') || name === 'typecheck');
			verify = {
				stepCommands: (stepNames.length > 0 ? stepNames : selected.slice(0, 1)).map(
					(name) => `${packageManager} ${name}`
				),
				taskCommands: selected.map((name) => `${packageManager} ${name}`),
			};
		}
	}

	let baseBranch: string | undefined;
	if (await fs.pathExists(path.join(rootDir, '.git'))) {
		const branches = await simpleGit(rootDir).branchLocal();
		if (branches.all.includes('latest')) {
			baseBranch = 'latest';
		}
	}

	return { baseBranch, verify };
}

function resolveRepositoryReviewers(
	repository?: string,
	reviewers?: string[],
	reviewerPresets?: Record<string, string[]>
): string[] | undefined {
	if (reviewers !== undefined) {
		return reviewers;
	}

	if (!repository) {
		return undefined;
	}

	return reviewerPresets?.[repository];
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
		reviewerPresets: z.record(z.string(), z.array(z.string())).optional(),
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
		maxNewFiles: z.number().int().min(1).default(3),
		maxInsertions: z.number().int().min(1).default(400),
	}),
});

export const defaultConfig: VibeConfig = configSchema.parse({
	jira: { fallbackProvider: 'atlassian-plugin' },
	figma: {},
	github: {
		reviewerPresets: {
			'lifebyte-systems/CRM-Sales-Frontend': ['jynxioxiao-lb', 'colinchen-lb'],
		},
	},
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
			baseBranch: inferred.baseBranch ?? defaultConfig.baseBranch,
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
		github: {
			...defaultConfig.github,
			...raw.github,
			reviewerPresets: {
				...(defaultConfig.github.reviewerPresets ?? {}),
				...(raw.github?.reviewerPresets ?? {}),
			},
		},
		pr: { ...defaultConfig.pr, ...raw.pr },
		planning: { ...defaultConfig.planning, ...raw.planning },
		verify: { ...defaultConfig.verify, ...raw.verify },
		review: { ...defaultConfig.review, ...raw.review },
		codeReview: { ...defaultConfig.codeReview, ...raw.codeReview },
	});

	const normalized = configSchema.parse({
		...merged,
		github: {
			...merged.github,
			reviewers: resolveRepositoryReviewers(
				merged.github.repository,
				merged.github.reviewers,
				merged.github.reviewerPresets
			),
		},
	});

	await fs.writeJson(configPath, normalized, { spaces: 2 });
	return normalized;
}
