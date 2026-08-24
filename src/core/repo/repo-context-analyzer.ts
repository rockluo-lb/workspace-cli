import fs from 'fs-extra';
import path from 'node:path';
import type { RepoAnalyzer, RepoAnalyzerInput, RepoContext, RepoConventions } from '../shared/types.js';

async function readPackageJson(root: string): Promise<Record<string, unknown> | null> {
	const filePath = path.join(root, 'package.json');
	if (!(await fs.pathExists(filePath))) {
		return null;
	}

	return fs.readJson(filePath) as Promise<Record<string, unknown>>;
}

function detectPackageManager(
	root: string,
	packageJson: Record<string, unknown> | null
): RepoContext['packageManager'] {
	const packageManager = typeof packageJson?.packageManager === 'string' ? packageJson.packageManager : '';
	if (packageManager.startsWith('yarn')) {
		return 'yarn';
	}
	if (packageManager.startsWith('npm')) {
		return 'npm';
	}
	if (packageManager.startsWith('pnpm') || fs.existsSync(path.join(root, 'pnpm-lock.yaml'))) {
		return 'pnpm';
	}
	if (fs.existsSync(path.join(root, 'yarn.lock'))) {
		return 'yarn';
	}
	return 'npm';
}

async function scanRouteFiles(root: string): Promise<RepoContext['routes']> {
	const candidates = ['src/pages', 'src/routes', 'app'];
	const routes: RepoContext['routes'] = [];

	for (const candidate of candidates) {
		const fullPath = path.join(root, candidate);
		if (!(await fs.pathExists(fullPath))) {
			continue;
		}

		const files = await fs.readdir(fullPath, { recursive: true });
		for (const file of files) {
			if (typeof file !== 'string') {
				continue;
			}
			if (!/\.(tsx?|jsx?)$/.test(file)) {
				continue;
			}
			routes.push({
				path: file.replace(/\.(tsx?|jsx?)$/, ''),
				file: path.join(candidate, file),
			});
		}
	}

	return routes;
}

const ESLINT_CONFIG_FILES = [
	'eslint.config.js',
	'eslint.config.mjs',
	'eslint.config.ts',
	'.eslintrc',
	'.eslintrc.js',
	'.eslintrc.json',
	'.eslintrc.cjs',
];
const PRETTIER_CONFIG_FILES = [
	'prettier.config.js',
	'prettier.config.mjs',
	'.prettierrc',
	'.prettierrc.js',
	'.prettierrc.json',
	'.prettierrc.yaml',
];
const BIOME_CONFIG_FILES = ['biome.json', 'biome.jsonc'];

async function listCursorRules(root: string): Promise<string[]> {
	const rulesDir = path.join(root, '.cursor', 'rules');
	if (!(await fs.pathExists(rulesDir))) {
		return [];
	}

	const entries = await fs.readdir(rulesDir, { recursive: true });
	return entries
		.filter((entry): entry is string => typeof entry === 'string' && /\.(mdc|md)$/.test(entry))
		.sort();
}

async function readTsStrict(root: string): Promise<boolean | undefined> {
	const filePath = path.join(root, 'tsconfig.json');
	if (!(await fs.pathExists(filePath))) {
		return undefined;
	}

	const raw = await fs.readFile(filePath, 'utf8');
	const withoutComments = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '');
	const match = withoutComments.match(/"strict"\s*:\s*(true|false)/);
	return match ? match[1] === 'true' : undefined;
}

async function collectConventions(
	root: string,
	packageJson: Record<string, unknown> | null,
	deps: Record<string, string>
): Promise<RepoConventions> {
	const hasAny = async (candidates: string[]): Promise<boolean> => {
		for (const candidate of candidates) {
			if (await fs.pathExists(path.join(root, candidate))) {
				return true;
			}
		}
		return false;
	};

	const lintTools: string[] = [];
	if (deps.eslint || (await hasAny(ESLINT_CONFIG_FILES))) {
		lintTools.push('eslint');
	}
	if (deps.prettier || (await hasAny(PRETTIER_CONFIG_FILES))) {
		lintTools.push('prettier');
	}
	if (deps['@biomejs/biome'] || (await hasAny(BIOME_CONFIG_FILES))) {
		lintTools.push('biome');
	}

	const scripts =
		typeof packageJson?.scripts === 'object' && packageJson.scripts !== null
			? Object.keys(packageJson.scripts as Record<string, string>)
			: [];

	return {
		cursorRules: await listCursorRules(root),
		hasAgentsMd: await fs.pathExists(path.join(root, 'AGENTS.md')),
		lintTools,
		tsStrict: await readTsStrict(root),
		scripts,
		dependencies: Object.keys(deps).sort(),
	};
}

export class DefaultRepoContextAnalyzer implements RepoAnalyzer {
	async analyze(input: RepoAnalyzerInput): Promise<RepoContext> {
		const packageJson = await readPackageJson(input.localRepoPath);
		const deps = {
			...(typeof packageJson?.dependencies === 'object'
				? (packageJson.dependencies as Record<string, string>)
				: {}),
			...(typeof packageJson?.devDependencies === 'object'
				? (packageJson.devDependencies as Record<string, string>)
				: {}),
		};

		const workspaceType = ['pnpm-workspace.yaml', 'turbo.json', 'nx.json'].some((file) =>
			fs.existsSync(path.join(input.localRepoPath, file))
		)
			? 'monorepo'
			: 'single';

		const uiFramework = deps.react
			? 'react'
			: deps.vue
				? 'vue'
				: deps.antd
					? 'antd'
					: deps['@mui/material']
						? 'mui'
						: undefined;
		const stateManagement = [
			deps['@tanstack/react-query'] ? 'react-query' : undefined,
			deps.zustand ? 'zustand' : undefined,
			deps.redux ? 'redux' : undefined,
			deps.mobx ? 'mobx' : undefined,
		].filter(Boolean) as string[];
		const testTools = [
			deps.vitest ? 'vitest' : undefined,
			deps.jest ? 'jest' : undefined,
			deps.playwright ? 'playwright' : undefined,
			deps.cypress ? 'cypress' : undefined,
		].filter(Boolean) as string[];

		const apps =
			workspaceType === 'monorepo'
				? ['apps', 'packages']
						.filter((segment) => fs.existsSync(path.join(input.localRepoPath, segment)))
						.flatMap((segment) =>
							fs
								.readdirSync(path.join(input.localRepoPath, segment), { withFileTypes: true })
								.filter((entry) => entry.isDirectory())
								.map((entry) => ({ name: entry.name, path: path.join(segment, entry.name) }))
						)
				: [];

		return {
			repoName: path.basename(input.localRepoPath),
			packageManager: detectPackageManager(input.localRepoPath, packageJson),
			workspaceType,
			apps,
			packages: workspaceType === 'monorepo' ? apps : [],
			routes: await scanRouteFiles(input.localRepoPath),
			uiFramework,
			stateManagement: stateManagement.length > 0 ? stateManagement : undefined,
			apiPattern: deps.axios ? 'services' : deps['@tanstack/react-query'] ? 'hooks+query' : undefined,
			testTools,
			conventions: await collectConventions(input.localRepoPath, packageJson, deps),
			partial: packageJson === null,
		};
	}
}
