import path from 'node:path';
import type { DiffGuard, DiffGuardResult, PlanStep } from '../shared/types.js';

const SENSITIVE_FILES = [
	/lock\.yaml$/,
	/package-lock\.json$/,
	/\.git\//,
	/^\.github\//,
	/^tsconfig\.json$/,
	/^pnpm-workspace\.yaml$/,
];

function normalize(file: string): string {
	return file.replace(/\\/g, '/');
}

function isNeighbor(expected: string, actual: string): boolean {
	return path.posix.dirname(normalize(expected)) === path.posix.dirname(normalize(actual));
}

export class DefaultDiffGuard implements DiffGuard {
	validate(step: PlanStep, changedFiles: string[]): DiffGuardResult {
		const normalizedFiles = changedFiles.map(normalize);
		const warnings: string[] = [];
		const errors: string[] = [];
		const expected = step.expectedFiles.map(normalize);

		for (const file of normalizedFiles) {
			if (SENSITIVE_FILES.some((pattern) => pattern.test(file))) {
				errors.push(`Sensitive or global file changed: ${file}`);
				continue;
			}

			if (expected.length === 0) {
				warnings.push(`No expected files defined for step ${step.id}; file changed: ${file}`);
				continue;
			}

			if (!expected.includes(file) && !expected.some((candidate) => isNeighbor(candidate, file))) {
				errors.push(`File out of scope for step ${step.id}: ${file}`);
			} else if (!expected.includes(file)) {
				warnings.push(`File is adjacent to expected scope and should be reviewed: ${file}`);
			}
		}

		if (normalizedFiles.length > Math.max(expected.length + 2, 6)) {
			errors.push(`Too many files changed for step ${step.id}: ${normalizedFiles.length}`);
		}

		return {
			ok: errors.length === 0,
			warnings,
			errors,
		};
	}
}
