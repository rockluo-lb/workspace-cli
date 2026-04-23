import fs from 'fs-extra';
import path from 'node:path';
import { writeJsonAtomic } from '../shared/fs-utils.js';
import type {
	ExecutionPlan,
	ExternalLink,
	JiraIssueContext,
	ProgressState,
	RepoContext,
	TaskStore,
} from '../shared/types.js';

export class FileTaskStore implements TaskStore {
	constructor(private readonly rootDir: string) {}

	get vibeDir(): string {
		return path.join(this.rootDir, '.vibe');
	}

	taskDir(jiraKey: string): string {
		return path.join(this.vibeDir, 'tasks', jiraKey);
	}

	async ensureTaskDirs(jiraKey: string): Promise<void> {
		await fs.ensureDir(path.join(this.taskDir(jiraKey), 'logs'));
		await fs.ensureDir(path.join(this.taskDir(jiraKey), 'reports'));
	}

	async loadIssue(jiraKey: string): Promise<JiraIssueContext | null> {
		return this.readJson<JiraIssueContext>(jiraKey, 'issue.json');
	}

	async saveIssue(jiraKey: string, issue: JiraIssueContext): Promise<void> {
		await this.writeJson(jiraKey, 'issue.json', issue);
	}

	async loadLinks(jiraKey: string): Promise<ExternalLink[] | null> {
		return this.readJson<ExternalLink[]>(jiraKey, 'links.json');
	}

	async saveLinks(jiraKey: string, links: ExternalLink[]): Promise<void> {
		await this.writeJson(jiraKey, 'links.json', links);
	}

	async loadRepoContext(jiraKey: string): Promise<RepoContext | null> {
		return this.readJson<RepoContext>(jiraKey, 'repo-context.json');
	}

	async saveRepoContext(jiraKey: string, repoContext: RepoContext): Promise<void> {
		await this.writeJson(jiraKey, 'repo-context.json', repoContext);
	}

	async loadPlan(jiraKey: string): Promise<ExecutionPlan | null> {
		return this.readJson<ExecutionPlan>(jiraKey, 'plan.json');
	}

	async savePlan(jiraKey: string, plan: ExecutionPlan): Promise<void> {
		await this.writeJson(jiraKey, 'plan.json', plan);
	}

	async loadProgress(jiraKey: string): Promise<ProgressState | null> {
		return this.readJson<ProgressState>(jiraKey, 'progress.json');
	}

	async saveProgress(jiraKey: string, progress: ProgressState): Promise<void> {
		await this.writeJson(jiraKey, 'progress.json', progress);
	}

	async writeReport(jiraKey: string, name: string, content: string): Promise<string> {
		await this.ensureTaskDirs(jiraKey);
		const filePath = path.join(this.taskDir(jiraKey), 'reports', name);
		await fs.writeFile(filePath, content, 'utf8');
		return filePath;
	}

	async appendLog(jiraKey: string, name: string, line: string): Promise<string> {
		await this.ensureTaskDirs(jiraKey);
		const filePath = path.join(this.taskDir(jiraKey), 'logs', name);
		await fs.appendFile(filePath, `${line}\n`, 'utf8');
		return filePath;
	}

	async writeTaskFile(jiraKey: string, name: string, content: string): Promise<string> {
		await this.ensureTaskDirs(jiraKey);
		const filePath = path.join(this.taskDir(jiraKey), name);
		await fs.writeFile(filePath, content, 'utf8');
		return filePath;
	}

	async clearVibeDir(): Promise<boolean> {
		if (!(await fs.pathExists(this.vibeDir))) {
			return false;
		}

		await fs.remove(this.vibeDir);
		return true;
	}

	private async readJson<T>(jiraKey: string, fileName: string): Promise<T | null> {
		const filePath = path.join(this.taskDir(jiraKey), fileName);
		if (!(await fs.pathExists(filePath))) {
			return null;
		}

		return fs.readJson(filePath) as Promise<T>;
	}

	private async writeJson(jiraKey: string, fileName: string, value: unknown): Promise<void> {
		await this.ensureTaskDirs(jiraKey);
		await writeJsonAtomic(path.join(this.taskDir(jiraKey), fileName), value);
	}
}
