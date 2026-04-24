import { DefaultDiffGuard } from './execution/diff-guard.js';
import { DefaultStepExecutor } from './execution/step-executor.js';
import { SimpleGitService } from './git/local-git-service.js';
import { ShellVerifyService } from './git/verify-service.js';
import { DefaultWorkflowOrchestrator } from './orchestrator/workflow-orchestrator.js';
import { MockAIProvider } from './planning/mock-ai-provider.js';
import { DefaultPlanner } from './planning/planner.js';
import { DefaultRepoContextAnalyzer } from './repo/repo-context-analyzer.js';
import { loadOrCreateConfig } from './shared/config.js';
import { createLogger } from './shared/logger.js';
import { resolveWorkspaceStateDir } from './shared/state-paths.js';
import { FileTaskStore } from './state/task-store.js';
import { MarkdownPrBuilder } from './templates/pr-builder.js';
import { createExternalToolAdapter } from './tools/tool-factory.js';

export async function createApp(rootDir: string) {
	const stateRoot = resolveWorkspaceStateDir(rootDir);
	const config = await loadOrCreateConfig(rootDir, stateRoot);
	const logger = createLogger();
	const tools = createExternalToolAdapter(config);
	const aiProvider = new MockAIProvider();
	const repoAnalyzer = new DefaultRepoContextAnalyzer();
	const planner = new DefaultPlanner(aiProvider, config);
	const verifyService = new ShellVerifyService(rootDir);
	const executor = new DefaultStepExecutor(rootDir, aiProvider, verifyService);
	const taskStore = new FileTaskStore(stateRoot);
	const orchestrator = new DefaultWorkflowOrchestrator({
		rootDir,
		stateRoot,
		config,
		tools,
		repoAnalyzer,
		planner,
		executor,
		gitService: new SimpleGitService(rootDir),
		verifyService,
		taskStore,
		aiProvider,
		diffGuard: new DefaultDiffGuard(),
		prBuilder: new MarkdownPrBuilder(),
	});

	return {
		stateRoot,
		config,
		logger,
		tools,
		aiProvider,
		repoAnalyzer,
		planner,
		verifyService,
		executor,
		taskStore,
		orchestrator,
	};
}
