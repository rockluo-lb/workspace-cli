import { createHash } from 'node:crypto';
import os from 'node:os';
import path from 'node:path';

function sanitizeWorkspaceName(name: string): string {
	return name
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 48);
}

export function resolveStateBaseDir(): string {
	if (process.env.VIBE_STATE_ROOT) {
		return path.resolve(process.env.VIBE_STATE_ROOT);
	}

	if (process.platform === 'darwin') {
		return path.join(os.homedir(), 'Library', 'Application Support', 'vibe-cli');
	}

	if (process.platform === 'win32') {
		return path.join(process.env.APPDATA ?? path.join(os.homedir(), 'AppData', 'Roaming'), 'vibe-cli');
	}

	return path.join(process.env.XDG_STATE_HOME ?? path.join(os.homedir(), '.local', 'state'), 'vibe-cli');
}

export function resolveWorkspaceStateDir(rootDir: string, baseDir = resolveStateBaseDir()): string {
	const resolvedRootDir = path.resolve(rootDir);
	const workspaceName = sanitizeWorkspaceName(path.basename(resolvedRootDir)) || 'workspace';
	const workspaceHash = createHash('sha1').update(resolvedRootDir).digest('hex').slice(0, 12);
	return path.join(baseDir, 'workspaces', `${workspaceName}-${workspaceHash}`);
}
