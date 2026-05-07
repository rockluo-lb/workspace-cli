import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import type { CommandResult, VerifyService } from '../shared/types.js';

const execAsync = promisify(exec);

export class ShellVerifyService implements VerifyService {
	constructor(private readonly rootDir: string) {}

	async run(commands: string[]): Promise<CommandResult[]> {
		const results: CommandResult[] = [];

		for (const command of commands) {
			try {
				const outcome = await execAsync(command, {
					cwd: this.rootDir,
					shell: '/bin/zsh',
				});
				results.push({
					command,
					code: 0,
					stdout: outcome.stdout,
					stderr: outcome.stderr,
				});
			} catch (error) {
				const failure = error as NodeJS.ErrnoException & {
					code?: number | string;
					stdout?: string;
					stderr?: string;
				};
				const exitCode: number = typeof failure.code === 'number' ? failure.code : 1;
				const stderr = failure.stderr ?? failure.message;
				// Detect command not found (exit code 127) and provide helpful message
				const enhancedStderr =
					exitCode === 127
						? `${stderr}\n\nHint: Command not found. Check that the script exists in your project's package.json and update vibe config (verify.taskCommands / verify.stepCommands) to match.`
						: stderr;
				results.push({
					command,
					code: exitCode,
					stdout: failure.stdout ?? '',
					stderr: enhancedStderr,
				});
			}
		}

		return results;
	}
}
