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

	it('allows files in the same directory as expected files (directory-level scope)', () => {
		const guard = new DefaultDiffGuard();
		const step = {
			id: 1,
			title: 'Refactor details',
			description: 'Split details.tsx into folder',
			expectedFiles: ['src/view/details.tsx'],
			verifyCommands: ['pnpm lint'],
			commitMessage: 'feat(CRMCN-1): refactor details',
			status: 'pending' as const,
		};

		// Files in the same directory should be allowed
		expect(guard.validate(step, ['src/view/details/index.tsx']).ok).toBe(true);
		expect(guard.validate(step, ['src/view/details/filter.tsx']).ok).toBe(true);
		expect(guard.validate(step, ['src/view/details/table.tsx']).ok).toBe(true);
		expect(guard.validate(step, ['src/view/details.tsx', 'src/view/details/index.tsx']).ok).toBe(true);

		// Files in a completely different directory should be blocked
		expect(guard.validate(step, ['src/other/file.ts']).ok).toBe(false);
	});
});
