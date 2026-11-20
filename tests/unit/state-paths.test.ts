import { describe, expect, it } from 'vitest';
import { chooseStateBaseDir } from '../../src/core/shared/state-paths.js';

describe('state base directory', () => {
	it('uses ~/.vibe once it exists, and also when neither directory exists', () => {
		expect(chooseStateBaseDir('/home/me/.vibe', '/home/me/legacy', true, true)).toBe('/home/me/.vibe');
		expect(chooseStateBaseDir('/home/me/.vibe', '/home/me/legacy', false, false)).toBe('/home/me/.vibe');
	});

	it('keeps the legacy directory until ~/.vibe is created', () => {
		expect(chooseStateBaseDir('/home/me/.vibe', '/home/me/legacy', false, true)).toBe('/home/me/legacy');
	});
});
