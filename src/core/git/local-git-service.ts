import fs from 'fs-extra';
import path from 'node:path';
import { simpleGit, type SimpleGit } from 'simple-git';
import { AppError } from '../shared/errors.js';
import type { DiffStat, LocalGitService } from '../shared/types.js';

function isOperationalFile(file: string): boolean {
	const normalized = file.replace(/\\/g, '/');
	return normalized.startsWith('.vibe/') || normalized.startsWith('.cursor/');
}

function parseNumstat(output: string): DiffStat[] {
	return output
		.split('\n')
		.map((line) => line.trim())
		.filter((line) => line.length > 0)
		.map((line) => {
			const columns = line.split('\t');
			const rawPath = columns.slice(2).join('\t');
			const withoutBraces = rawPath.replace(/\{.*? => (.*?)\}/, '$1');
			const resolvedPath = withoutBraces.includes(' => ')
				? (withoutBraces.split(' => ').pop() ?? withoutBraces)
				: withoutBraces;
			return {
				file: path.normalize(resolvedPath),
				insertions: Number.parseInt(columns[0] ?? '', 10) || 0,
				deletions: Number.parseInt(columns[1] ?? '', 10) || 0,
			};
		});
}

function mergeDiffStats(groups: DiffStat[][]): DiffStat[] {
	const merged = new Map<string, DiffStat>();
	for (const stats of groups) {
		for (const stat of stats) {
			if (isOperationalFile(stat.file)) {
				continue;
			}
			const existing = merged.get(stat.file);
			if (existing) {
				existing.insertions += stat.insertions;
				existing.deletions += stat.deletions;
				continue;
			}
			merged.set(stat.file, { ...stat });
		}
	}
	return [...merged.values()];
}

function formatDirtyWorktreeMessage(files: string[]): string {
	const preview = files
		.slice(0, 8)
		.map((file) => `- ${file}`)
		.join('\n');
	const suffix = files.length > 8 ? `\n- ...and ${files.length - 8} more` : '';
	return [
		'Git worktree must be clean before starting a task.',
		'',
		'Dirty files:',
		preview,
		suffix,
		'',
		'Commit, stash, or discard these changes before running `vibe start`.',
	].join('\n');
}

export class SimpleGitService implements LocalGitService {
	private readonly git: SimpleGit;

	constructor(private readonly rootDir: string) {
		this.git = simpleGit(rootDir);
	}

	async ensureCleanWorktree(): Promise<void> {
		const status = await this.git.status();
		const files = [
			...status.modified,
			...status.created,
			...status.deleted,
			...status.not_added,
			...status.staged,
			...status.renamed.map((entry) => entry.to),
		].filter((file) => !isOperationalFile(file));
		if (files.length > 0) {
			throw new AppError('GIT_DIRTY_WORKTREE', formatDirtyWorktreeMessage(files));
		}
	}

	async checkoutBaseBranch(baseBranch: string): Promise<void> {
		await this.git.checkout(baseBranch);
	}

	async pullBaseBranch(baseBranch: string): Promise<void> {
		const remotes = await this.git.getRemotes(true);
		if (remotes.length === 0) {
			return;
		}

		await this.git.pull('origin', baseBranch);
	}

	async createBranch(branchName: string): Promise<void> {
		const branch = await this.git.branchLocal();
		if (branch.all.includes(branchName)) {
			throw new AppError('BRANCH_ALREADY_EXISTS', `Branch already exists: ${branchName}`);
		}
		await this.git.checkoutLocalBranch(branchName);
	}

	async getDiffFiles(): Promise<string[]> {
		const status = await this.git.status();
		const files = new Set<string>();
		for (const file of [
			...status.modified,
			...status.created,
			...status.deleted,
			...status.not_added,
			...status.staged,
			...status.renamed.map((entry) => entry.to),
		]) {
			if (!isOperationalFile(file)) {
				files.add(path.normalize(file));
			}
		}
		return [...files];
	}

	async getDiffStat(): Promise<DiffStat[]> {
		const unstaged = parseNumstat(await this.git.raw(['diff', '--numstat']));
		const staged = parseNumstat(await this.git.raw(['diff', '--numstat', '--cached']));
		const status = await this.git.status();
		const untracked: DiffStat[] = [];

		for (const file of status.not_added) {
			if (isOperationalFile(file)) {
				continue;
			}
			const absolutePath = path.join(this.rootDir, file);
			const stat = await fs.stat(absolutePath);
			if (!stat.isFile()) {
				continue;
			}
			const content = await fs.readFile(absolutePath, 'utf8');
			untracked.push({
				file: path.normalize(file),
				insertions: content.length === 0 ? 0 : content.split('\n').length,
				deletions: 0,
			});
		}

		return mergeDiffStats([unstaged, staged, untracked]);
	}

	async addFiles(files: string[]): Promise<void> {
		if (files.length === 0) {
			return;
		}
		await this.git.add(files);
	}

	async commit(message: string): Promise<string> {
		const result = await this.git.commit(message);
		return result.commit;
	}

	async getCurrentBranch(): Promise<string> {
		const branch = await this.git.branchLocal();
		return branch.current;
	}

	async listCommitsSince(baseBranch: string): Promise<Array<{ sha: string; message: string }>> {
		const local = await this.git.branchLocal();
		const args = ['log', '--pretty=format:%H%x09%s'];
		if (local.all.includes(baseBranch)) {
			args.splice(1, 0, `${baseBranch}..HEAD`);
		}
		const output = await this.git.raw(args);
		return output
			.split('\n')
			.map((line) => line.trim())
			.filter((line) => line.length > 0)
			.flatMap((line) => {
				const tab = line.indexOf('\t');
				if (tab <= 0) {
					return [];
				}
				return [{ sha: line.slice(0, tab), message: line.slice(tab + 1) }];
			});
	}
}
