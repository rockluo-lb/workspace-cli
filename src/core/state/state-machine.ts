import { AppError } from '../shared/errors.js';
import type { PlanStepStatus, TaskStatus } from '../shared/types.js';

const taskTransitions: Record<TaskStatus, TaskStatus[]> = {
	initialized: ['context_ready', 'planned', 'failed', 'aborted'],
	context_ready: ['planned', 'failed', 'aborted'],
	planned: ['reviewing', 'failed', 'aborted'],
	reviewing: ['planned', 'plan_approved', 'failed', 'aborted'],
	plan_approved: ['planned', 'coding', 'verifying', 'failed', 'aborted'],
	coding: ['planned', 'plan_approved', 'verifying', 'failed', 'aborted'],
	verifying: ['pr_ready', 'failed', 'aborted'],
	pr_ready: ['failed', 'aborted'],
	aborted: [],
	failed: [
		'initialized',
		'context_ready',
		'planned',
		'reviewing',
		'plan_approved',
		'coding',
		'verifying',
		'aborted',
	],
};

const stepTransitions: Record<PlanStepStatus, PlanStepStatus[]> = {
	pending: ['coded', 'verified', 'committed', 'failed'],
	coded: ['verified', 'committed', 'failed'],
	verified: ['committed', 'failed'],
	committed: [],
	failed: ['pending', 'coded', 'verified', 'committed'],
};

export function canTransitionTaskStatus(from: TaskStatus, to: TaskStatus): boolean {
	return taskTransitions[from].includes(to);
}

export function canTransitionStepStatus(from: PlanStepStatus, to: PlanStepStatus): boolean {
	return stepTransitions[from].includes(to);
}

export function assertTaskTransition(from: TaskStatus, to: TaskStatus): void {
	if (!canTransitionTaskStatus(from, to)) {
		throw new AppError('STATE_CORRUPTED', `Invalid task status transition: ${from} -> ${to}`);
	}
}

export function assertStepTransition(from: PlanStepStatus, to: PlanStepStatus): void {
	if (!canTransitionStepStatus(from, to)) {
		throw new AppError('STATE_CORRUPTED', `Invalid step status transition: ${from} -> ${to}`);
	}
}
