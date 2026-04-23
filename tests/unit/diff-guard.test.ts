import { describe, expect, it } from 'vitest';
import { DefaultDiffGuard } from '../../src/core/execution/diff-guard.js';

describe('diff guard', () => {
	it('allows expected files and blocks unrelated files', () => {
		const guard = new DefaultDiffGuard();
		const step = {
			id: 1,
			title: 'Wire state',
			description: 'Wire state',
			expectedFiles: ['src/feature/form.ts'],
			verifyCommands: ['pnpm lint'],
			commitMessage: 'feat(CRMCN-1): wire state',
			status: 'pending' as const,
		};

		expect(guard.validate(step, ['src/feature/form.ts']).ok).toBe(true);
		expect(guard.validate(step, ['src/other/file.ts']).ok).toBe(false);
	});
});
