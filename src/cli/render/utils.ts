import type { Primitive, Tone } from './types.js';

export function isPlainObject(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function primitiveToString(value: Primitive): string {
	if (value === undefined) {
		return '-';
	}

	if (value === null) {
		return 'null';
	}

	return String(value);
}

export function titleFromKey(key: string): string {
	return key
		.replace(/([a-z0-9])([A-Z])/g, '$1 $2')
		.replace(/[_-]+/g, ' ')
		.replace(/\b\w/g, (char) => char.toUpperCase());
}

export function statusColor(status: string): Exclude<Tone, 'gray'> {
	if (['pr_ready', 'committed', 'verified', 'pass', 'ready'].includes(status)) {
		return 'green';
	}
	if (['failed', 'error', 'fail'].includes(status)) {
		return 'red';
	}
	if (['planned', 'coding', 'verifying', 'initialized', 'context_ready'].includes(status)) {
		return 'yellow';
	}
	return 'cyan';
}
