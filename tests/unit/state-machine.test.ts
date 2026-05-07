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

	it('allows pending -> committed (skip intermediate states)', () => {
		expect(canTransitionStepStatus('pending', 'committed')).toBe(true);
		expect(() => assertStepTransition('pending', 'committed')).not.toThrow();
	});

	it('allows failed -> committed (recover and commit directly)', () => {
		expect(canTransitionStepStatus('failed', 'committed')).toBe(true);
		expect(() => assertStepTransition('failed', 'committed')).not.toThrow();
	});

	it('blocks invalid transitions', () => {
		expect(canTransitionTaskStatus('initialized', 'pr_ready')).toBe(false);
		expect(() => assertStepTransition('committed', 'coded')).toThrow();
	});
});
