import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { DefaultStepExecutor } from '../../src/core/execution/step-executor.js';
import { MockAIProvider } from '../../src/core/planning/mock-ai-provider.js';
import type { CommandResult, ExecuteStepInput, VerifyService } from '../../src/core/shared/types.js';
import { createTempDir } from '../helpers/test-env.js';

class RecordingVerifyService implements VerifyService {
	commands: string[] = [];

	async run(commands: string[]): Promise<CommandResult[]> {
		this.commands.push(...commands);
		return commands.map((command) => ({ command, code: 0, stdout: '', stderr: '' }));
	}
}

function makeInput(verifyCommands: string[], changedFiles: string[]): ExecuteStepInput {
	return {
		jiraKey: 'CRMCN-1',
		step: {
			id: 1,
			title: 'Edit list',
			description: 'Edit list',
			expectedFiles: [],
			verifyCommands,
			commitMessage: 'feat(CRMCN-1): edit list',
			status: 'pending',
		},
		repoContext: {
			repoName: 'demo',
			packageManager: 'pnpm',
			workspaceType: 'single',
			apps: [],
			packages: [],
			routes: [],
			testTools: [],
		},
		changedFiles,
	};
}

describe('DefaultStepExecutor', () => {
	it('lints only the changed source files that still exist', async () => {
		const rootDir = await createTempDir('vibe-executor-');
		await fs.ensureDir(path.join(rootDir, 'src'));
		await fs.writeFile(path.join(rootDir, 'src', 'list.tsx'), 'export {};\n', 'utf8');
		await fs.writeFile(path.join(rootDir, 'src', "it's.ts"), 'export {};\n', 'utf8');
		const verify = new RecordingVerifyService();
		const executor = new DefaultStepExecutor(rootDir, new MockAIProvider(), verify);

		await executor.execute(
			makeInput(
				['pnpm exec eslint {files}', 'pnpm lint:css'],
				['src/list.tsx', "src/it's.ts", 'src/removed.ts', 'README.md']
			)
		);

		expect(verify.commands).toEqual([`pnpm exec eslint 'src/list.tsx' 'src/it'\\''s.ts'`, 'pnpm lint:css']);
	});

	it('skips a files command when no source file changed', async () => {
		const rootDir = await createTempDir('vibe-executor-empty-');
		const verify = new RecordingVerifyService();
		const executor = new DefaultStepExecutor(rootDir, new MockAIProvider(), verify);

		const result = await executor.execute(makeInput(['pnpm exec eslint {files}'], ['docs/flow.md']));

		expect(verify.commands).toEqual([]);
		expect(result.verifyResults).toEqual([]);
	});
});
