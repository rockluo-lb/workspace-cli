import fs from 'fs-extra';

export async function loadFixtureMap<T>(envName: string): Promise<Record<string, T> | null> {
	const raw = process.env[envName];
	if (!raw) {
		return null;
	}

	if (raw.trim().startsWith('{')) {
		return JSON.parse(raw) as Record<string, T>;
	}

	if (await fs.pathExists(raw)) {
		return fs.readJson(raw) as Promise<Record<string, T>>;
	}

	return null;
}
