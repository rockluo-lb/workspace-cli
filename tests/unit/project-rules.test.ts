import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadProjectRules } from '../../src/core/repo/project-rules.js';
import { createTempDir } from '../helpers/test-env.js';

async function writeRule(rootDir: string, name: string, frontmatter: string, body: string): Promise<void> {
	const rulesDir = path.join(rootDir, '.cursor', 'rules');
	await fs.ensureDir(rulesDir);
	await fs.writeFile(path.join(rulesDir, name), `---\n${frontmatter}\n---\n\n${body}\n`, 'utf8');
}

describe('loadProjectRules', () => {
	it('applies always-on and glob-matched rules and lists the rest on demand', async () => {
		const rootDir = await createTempDir('vibe-rules-');
		await writeRule(rootDir, '01-core.mdc', 'description: Core\nalwaysApply: true', '# Core rules');
		await writeRule(rootDir, '03-tailwind.mdc', "description: Tailwind\nglobs: ['**/*.vue', '**/*.css']", '# Tailwind');
		await writeRule(rootDir, '04-api.mdc', 'description: API\nglobs: src/api/**/*.ts', '# API');
		await writeRule(rootDir, '08-commit.mdc', 'description: Commit rules\nalwaysApply: false', '# Commit');
		await fs.writeFile(path.join(rootDir, 'AGENTS.md'), '# Agents\n', 'utf8');

		const rules = await loadProjectRules(rootDir, ['src/views/list.vue']);

		expect(rules.applied.map((rule) => rule.file)).toEqual([
			'.cursor/rules/01-core.mdc',
			'.cursor/rules/03-tailwind.mdc',
		]);
		expect(rules.applied[1]?.content).toBe('# Tailwind');
		expect(rules.onDemand.map((rule) => [rule.file, rule.description])).toEqual([
			['.cursor/rules/04-api.mdc', 'API'],
			['.cursor/rules/08-commit.mdc', 'Commit rules'],
		]);
		expect(rules.agentsMd).toBe('# Agents');
	});

	it('returns empty rules when the repo has none', async () => {
		const rootDir = await createTempDir('vibe-rules-empty-');
		await expect(loadProjectRules(rootDir, ['src/a.ts'])).resolves.toEqual({
			applied: [],
			onDemand: [],
			agentsMd: undefined,
		});
	});
});
