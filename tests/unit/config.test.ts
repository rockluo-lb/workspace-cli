import fs from 'fs-extra';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadOrCreateConfig } from '../../src/core/shared/config.js';
import { createTempDir } from '../helpers/test-env.js';

describe('config loading', () => {
	it('creates a default config when missing', async () => {
		const rootDir = await createTempDir('vibe-config-');
		const config = await loadOrCreateConfig(rootDir);
		expect(config.branchPattern).toBe('feat/{jiraKey}');
		expect(await fs.pathExists(path.join(rootDir, '.vibe', 'config.json'))).toBe(true);
	});
});
