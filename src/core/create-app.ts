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
import { FileTaskStore } from './state/task-store.js';
import { MarkdownPrBuilder } from './templates/pr-builder.js';
import { createExternalToolAdapter } from './tools/tool-factory.js';

export async function createApp(rootDir: string) {
	const config = await loadOrCreateConfig(rootDir);
	const logger = createLogger();
	const tools = createExternalToolAdapter(config);
	const aiProvider = new MockAIProvider();
	const repoAnalyzer = new DefaultRepoContextAnalyzer();
	const planner = new DefaultPlanner(aiProvider, config);
	const verifyService = new ShellVerifyService(rootDir);
	const executor = new DefaultStepExecutor(rootDir, aiProvider, verifyService);
	const taskStore = new FileTaskStore(rootDir);
	const orchestrator = new DefaultWorkflowOrchestrator({
		rootDir,
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
