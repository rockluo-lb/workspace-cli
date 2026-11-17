import fs from 'fs-extra';
import path from 'node:path';

export interface ProjectRule {
	file: string;
	description?: string;
	content: string;
}

export interface ProjectRules {
	applied: ProjectRule[];
	onDemand: ProjectRule[];
	agentsMd?: string;
}

function parseFrontmatter(raw: string): { meta: Record<string, string>; body: string } {
	const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
	if (!match) {
		return { meta: {}, body: raw };
	}
	const meta: Record<string, string> = {};
	for (const line of (match[1] ?? '').split(/\r?\n/)) {
		const separator = line.indexOf(':');
		if (separator > 0) {
			meta[line.slice(0, separator).trim()] = line.slice(separator + 1).trim();
		}
	}
	return { meta, body: raw.slice(match[0].length) };
}

function parseGlobs(value: string | undefined): string[] {
	if (!value) {
		return [];
	}
	return value
		.replace(/^\[|\]$/g, '')
		.split(',')
		.map((glob) => glob.trim().replace(/^['"]|['"]$/g, ''))
		.filter((glob) => glob.length > 0);
}

function matchesAny(files: string[], globs: string[]): boolean {
	return files.some((file) => globs.some((glob) => path.matchesGlob(file, glob)));
}

export async function loadProjectRules(rootDir: string, files: string[]): Promise<ProjectRules> {
	const rulesDir = path.join(rootDir, '.cursor', 'rules');
	const applied: ProjectRule[] = [];
	const onDemand: ProjectRule[] = [];

	if (await fs.pathExists(rulesDir)) {
		const entries = (await fs.readdir(rulesDir, { recursive: true }))
			.filter((entry): entry is string => typeof entry === 'string' && /\.(mdc|md)$/.test(entry))
			.sort();
		for (const entry of entries) {
			const { meta, body } = parseFrontmatter(await fs.readFile(path.join(rulesDir, entry), 'utf8'));
			const rule: ProjectRule = {
				file: path.posix.join('.cursor/rules', entry.replace(/\\/g, '/')),
				description: meta.description,
				content: body.trim(),
			};
			const normalizedFiles = files.map((file) => file.replace(/\\/g, '/'));
			if (meta.alwaysApply === 'true' || matchesAny(normalizedFiles, parseGlobs(meta.globs))) {
				applied.push(rule);
			} else {
				onDemand.push(rule);
			}
		}
	}

	const agentsMdPath = path.join(rootDir, 'AGENTS.md');
	const agentsMd = (await fs.pathExists(agentsMdPath))
		? (await fs.readFile(agentsMdPath, 'utf8')).trim()
		: undefined;

	return { applied, onDemand, agentsMd };
}
