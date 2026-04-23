export type PackageManager = 'npm' | 'pnpm' | 'yarn';
export type WorkspaceType = 'single' | 'monorepo';
export type LinkType = 'jira' | 'confluence' | 'figma' | 'prototype' | 'api-doc' | 'other';
export type LinkSource = 'description' | 'remoteLink' | 'comment' | 'manual';
export type FigmaMode = 'file' | 'design' | 'proto';
export type JiraProviderMode = 'auto' | 'atlassian-mcp' | 'atlassian-plugin';
export type FigmaProviderMode = 'figma-mcp' | 'figma-plugin';
export type GitHubProviderMode = 'github-mcp' | 'github-plugin';
export type PlanStepStatus = 'pending' | 'coded' | 'verified' | 'committed' | 'failed';
export type TaskStatus =
	| 'initialized'
	| 'context_ready'
	| 'planned'
	| 'coding'
	| 'verifying'
	| 'pr_ready'
	| 'aborted'
	| 'failed';
export type AppErrorCode =
	| 'INVALID_JIRA_KEY'
	| 'JIRA_FETCH_FAILED'
	| 'GIT_DIRTY_WORKTREE'
	| 'BRANCH_ALREADY_EXISTS'
	| 'PLAN_NOT_FOUND'
	| 'STEP_NOT_FOUND'
	| 'STEP_ALREADY_COMMITTED'
	| 'VERIFY_FAILED'
	| 'DIFF_OUT_OF_SCOPE'
	| 'STATE_CORRUPTED'
	| 'CAPABILITY_UNAVAILABLE';

export interface ExternalLink {
	type: LinkType;
	url: string;
	source: LinkSource;
	title?: string;
	metadata?: Record<string, string>;
}

export interface IssueCommentContext {
	id: string;
	body: string;
	author?: string;
	createdAt?: string;
}

export interface ConfluencePageContext {
	url: string;
	title?: string;
	excerpt: string;
}

export interface JiraIssueContext {
	key: string;
	summary: string;
	description?: string;
	acceptanceCriteria: string[];
	labels: string[];
	issueType?: string;
	status?: string;
	assignee?: string;
	links: ExternalLink[];
}

export interface FigmaReference {
	url: string;
	fileId?: string;
	nodeId?: string;
	mode?: FigmaMode;
}

export interface FigmaDesignContext {
	title?: string;
	fileId?: string;
	nodeId?: string;
	pageName?: string;
	nodeName?: string;
	texts: string[];
	components: string[];
	layoutHints: string[];
	previewUrl?: string;
	partial?: boolean;
}

export interface GitHubRepoContext {
	fullName: string;
	defaultBranch: string;
	languages?: string[];
	topics?: string[];
	description?: string;
}

export interface GitHubCodeSearchResult {
	path: string;
	repository: string;
	snippet: string;
}

export interface GitHubPRContext {
	number: number;
	title: string;
	url: string;
	state: string;
}

export interface PRContext {
	repositoryFullName: string;
	branchName: string;
	compareUrl?: string;
	relatedPRs: GitHubPRContext[];
}

export interface RepoApp {
	name: string;
	path: string;
}

export interface RepoPackage {
	name: string;
	path: string;
}

export interface RouteInfo {
	path: string;
	file: string;
}

export interface RepoContext {
	repoName: string;
	packageManager: PackageManager;
	workspaceType: WorkspaceType;
	apps: RepoApp[];
	packages: RepoPackage[];
	routes: RouteInfo[];
	uiFramework?: string;
	stateManagement?: string[];
	apiPattern?: string;
	testTools: string[];
	partial?: boolean;
}

export interface PlanStep {
	id: number;
	title: string;
	description: string;
	rationale?: string;
	expectedFiles: string[];
	verifyCommands: string[];
	commitMessage: string;
	status: PlanStepStatus;
}

export interface ExecutionPlan {
	jiraKey: string;
	branch: string;
	summary: string;
	assumptions: string[];
	risks: string[];
	steps: PlanStep[];
}

export interface ExecutionPlanDraft {
	summary?: string;
	assumptions?: string[];
	risks?: string[];
	steps: Array<Partial<PlanStep>>;
}

export interface StepExecutionDraft {
	summary: string;
	warnings: string[];
	verifyCommands?: string[];
	reportSections: string[];
}

export interface ExecuteStepInput {
	jiraKey: string;
	step: PlanStep;
	repoContext: RepoContext;
	dryRun?: boolean;
	maxFiles?: number;
}

export interface CommandResult {
	command: string;
	code: number;
	stdout: string;
	stderr: string;
}

export interface ExecuteStepResult {
	changedFiles: string[];
	summary: string;
	warnings: string[];
	verifyResults?: CommandResult[];
}

export interface DiffGuardResult {
	ok: boolean;
	warnings: string[];
	errors: string[];
}

export interface ProgressCommit {
	step: number;
	sha: string;
	message: string;
}

export interface ProgressState {
	jiraKey: string;
	branch: string;
	currentStep?: number;
	completedSteps: number[];
	commits: ProgressCommit[];
	status: TaskStatus;
	lastError?: string;
}

export interface VibeConfig {
	branchPattern: string;
	commitPattern: string;
	baseBranch: string;
	jira: {
		provider: JiraProviderMode;
		fallbackProvider?: Exclude<JiraProviderMode, 'auto'>;
		allowedPrefixes: string[];
	};
	figma: {
		provider: FigmaProviderMode;
		fallbackProvider?: FigmaProviderMode;
	};
	github: {
		provider: GitHubProviderMode;
		fallbackProvider?: GitHubProviderMode;
		repository?: string;
		reviewers?: string[];
		reviewerPresets?: Record<string, string[]>;
	};
	pr: {
		aiDisclosure: string;
	};
	planning: {
		minSteps: number;
		maxSteps: number;
		maxFilesPerStep: number;
	};
	verify: {
		stepCommands: string[];
		taskCommands: string[];
	};
}

export interface StartTaskResult {
	jiraKey: string;
	initialBranch: string;
	baseBranch: string;
	branch: string;
	currentBranch: string;
	taskDir: string;
	warnings: string[];
}

export interface ContextResult {
	jiraKey: string;
	reportPath: string;
	repoContext: RepoContext;
	warnings: string[];
}

export interface PlanResult {
	jiraKey: string;
	plan: ExecutionPlan;
	reportPath: string;
}

export interface CommitStepResult {
	jiraKey: string;
	stepId: number;
	sha: string;
	message: string;
}

export interface VerifyResult {
	jiraKey: string;
	reportPath: string;
	results: CommandResult[];
}

export interface PRResult {
	jiraKey: string;
	reportPath: string;
	content: string;
}

export interface ResumeResult {
	jiraKey: string;
	status: TaskStatus;
	nextAction: string;
	pendingSteps: number[];
}

export interface DiffGuard {
	validate(step: PlanStep, changedFiles: string[]): DiffGuardResult;
}

export interface PRBuildInput {
	issue: JiraIssueContext;
	links: ExternalLink[];
	plan: ExecutionPlan;
	progress: ProgressState;
	aiDisclosure: string;
	reviewers: string[];
	verifyResults?: CommandResult[];
	prContext?: PRContext;
}

export interface PRBuilder {
	build(input: PRBuildInput): Promise<string>;
}

export interface JiraProvider {
	getIssue(issueKey: string): Promise<JiraIssueContext>;
	getIssueLinks(issueKey: string): Promise<ExternalLink[]>;
	getIssueComments(issueKey: string): Promise<IssueCommentContext[]>;
	resolveConfluence(url: string): Promise<ConfluencePageContext | null>;
}

export interface FigmaProvider {
	parseUrl(url: string): Promise<FigmaReference>;
	resolveContext(ref: FigmaReference): Promise<FigmaDesignContext>;
}

export interface GitHubProvider {
	getRepositoryMeta(repositoryFullName: string): Promise<GitHubRepoContext>;
	searchCode(repositoryFullName: string, query: string): Promise<GitHubCodeSearchResult[]>;
	getRecentRelatedPRs(repositoryFullName: string, jiraKey: string): Promise<GitHubPRContext[]>;
	preparePRContext(repositoryFullName: string, branchName: string): Promise<PRContext>;
}

export interface ExternalToolAdapter {
	jira: JiraProvider;
	figma: FigmaProvider;
	github: GitHubProvider;
}

export interface AIPlanInput {
	issue: JiraIssueContext;
	links: ExternalLink[];
	repoContext: RepoContext;
	config: VibeConfig;
}

export interface AIStepExecutionInput {
	jiraKey: string;
	step: PlanStep;
	repoContext: RepoContext;
	fileSummaries: Array<{ path: string; excerpt: string }>;
	dryRun?: boolean;
}

export interface AIProvider {
	generatePlan(input: AIPlanInput): Promise<ExecutionPlanDraft>;
	prepareStepExecution(input: AIStepExecutionInput): Promise<StepExecutionDraft>;
}

export interface RepoAnalyzerInput {
	localRepoPath: string;
	repositoryFullName?: string;
	githubContext?: GitHubRepoContext;
}

export interface RepoAnalyzer {
	analyze(input: RepoAnalyzerInput): Promise<RepoContext>;
}

export interface StepExecutor {
	execute(input: ExecuteStepInput): Promise<ExecuteStepResult>;
}

export interface LocalGitService {
	ensureCleanWorktree(): Promise<void>;
	checkoutBaseBranch(baseBranch: string): Promise<void>;
	pullBaseBranch(baseBranch: string): Promise<void>;
	createBranch(branchName: string): Promise<void>;
	getDiffFiles(): Promise<string[]>;
	addFiles(files: string[]): Promise<void>;
	commit(message: string): Promise<string>;
	getCurrentBranch(): Promise<string>;
}

export interface VerifyService {
	run(commands: string[]): Promise<CommandResult[]>;
}

export interface TaskStore {
	loadIssue(jiraKey: string): Promise<JiraIssueContext | null>;
	saveIssue(jiraKey: string, issue: JiraIssueContext): Promise<void>;
	loadLinks(jiraKey: string): Promise<ExternalLink[] | null>;
	saveLinks(jiraKey: string, links: ExternalLink[]): Promise<void>;
	loadRepoContext(jiraKey: string): Promise<RepoContext | null>;
	saveRepoContext(jiraKey: string, repoContext: RepoContext): Promise<void>;
	loadPlan(jiraKey: string): Promise<ExecutionPlan | null>;
	savePlan(jiraKey: string, plan: ExecutionPlan): Promise<void>;
	loadProgress(jiraKey: string): Promise<ProgressState | null>;
	saveProgress(jiraKey: string, progress: ProgressState): Promise<void>;
	writeTaskFile(jiraKey: string, name: string, content: string): Promise<string>;
	writeReport(jiraKey: string, name: string, content: string): Promise<string>;
	appendLog(jiraKey: string, name: string, line: string): Promise<string>;
	clearVibeDir(): Promise<boolean>;
}

export interface WorkflowOrchestrator {
	startTask(jiraKey: string): Promise<StartTaskResult>;
	buildContext(jiraKey: string): Promise<ContextResult>;
	generatePlan(jiraKey: string): Promise<PlanResult>;
	executeStep(jiraKey: string, stepId: number, options?: { dryRun?: boolean }): Promise<ExecuteStepResult>;
	commitStep(jiraKey: string, stepId: number): Promise<CommitStepResult>;
	verifyTask(jiraKey: string): Promise<VerifyResult>;
	preparePR(jiraKey: string): Promise<PRResult>;
	resumeTask(jiraKey: string): Promise<ResumeResult>;
	abortTask(jiraKey: string): Promise<void>;
}

export interface WorkflowOrchestratorDeps {
	rootDir: string;
	config: VibeConfig;
	tools: ExternalToolAdapter;
	repoAnalyzer: RepoAnalyzer;
	planner: {
		generate(params: AIPlanInput & { jiraKey: string }): Promise<ExecutionPlan>;
		render(plan: ExecutionPlan): string;
	};
	executor: StepExecutor;
	gitService: LocalGitService;
	verifyService: VerifyService;
	taskStore: TaskStore;
	aiProvider: AIProvider;
	diffGuard: DiffGuard;
	prBuilder: PRBuilder;
}
