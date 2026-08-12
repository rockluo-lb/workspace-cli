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
		expect(() => assertTaskTransition('plan_approved', 'coding')).not.toThrow();
		expect(() => assertStepTransition('coded', 'verified')).not.toThrow();
	});

	it('enforces the plan -> review -> plan_approved loop', () => {
		expect(canTransitionTaskStatus('planned', 'coding')).toBe(false);
		expect(canTransitionTaskStatus('planned', 'reviewing')).toBe(true);
		expect(canTransitionTaskStatus('reviewing', 'planned')).toBe(true);
		expect(canTransitionTaskStatus('reviewing', 'plan_approved')).toBe(true);
		expect(canTransitionTaskStatus('plan_approved', 'coding')).toBe(true);
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
