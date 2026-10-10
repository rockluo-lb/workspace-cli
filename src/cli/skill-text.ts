import fs from 'fs-extra';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { AppError } from '../core/shared/errors.js';

export async function loadSkillText(): Promise<string> {
	const here = path.dirname(fileURLToPath(import.meta.url));
	const candidates = [path.resolve(here, '../../skill.md'), path.resolve(here, '../../../skill.md')];
	for (const candidate of candidates) {
		if (await fs.pathExists(candidate)) {
			return fs.readFile(candidate, 'utf8');
		}
	}
	throw new AppError(
		'CAPABILITY_UNAVAILABLE',
		`Agent skill was not found. Looked in:\n${candidates.map((candidate) => `- ${candidate}`).join('\n')}`
	);
}
