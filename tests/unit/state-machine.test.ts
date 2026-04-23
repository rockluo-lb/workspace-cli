import { describe, expect, it } from 'vitest';
import {
	assertStepTransition,
	assertTaskTransition,
	canTransitionStepStatus,
	canTransitionTaskStatus,
} from '../../src/core/state/state-machine.js';

describe('state machine', () => {
	it('allows valid transitions', () => {
		expect(canTransitionTaskStatus('initialized', 'context_ready')).toBe(true);
		expect(canTransitionStepStatus('pending', 'coded')).toBe(true);
		expect(() => assertTaskTransition('planned', 'coding')).not.toThrow();
		expect(() => assertStepTransition('coded', 'verified')).not.toThrow();
	});

	it('blocks invalid transitions', () => {
		expect(canTransitionTaskStatus('initialized', 'pr_ready')).toBe(false);
		expect(() => assertStepTransition('committed', 'coded')).toThrow();
	});
});
