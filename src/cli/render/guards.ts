import type {
	CommitStepResult,
	ContextResult,
	ExecuteStepResult,
	PRResult,
	PlanResult,
	ProgressState,
	ResumeResult,
	StartTaskResult,
	VerifyResult,
} from '../../core/shared/types.js';
import { isPlainObject } from './utils.js';

export function isStartTaskResult(value: unknown): value is StartTaskResult {
	return (
		isPlainObject(value) &&
		'initialBranch' in value &&
		'baseBranch' in value &&
		'currentBranch' in value &&
		'taskDir' in value
	);
}

export function isPlanResult(value: unknown): value is PlanResult {
	return isPlainObject(value) && 'plan' in value && 'reportPath' in value;
}

export function isContextResult(value: unknown): value is ContextResult {
	return isPlainObject(value) && 'repoContext' in value && 'reportPath' in value && 'warnings' in value;
}

export function isResumeResult(value: unknown): value is ResumeResult {
	return isPlainObject(value) && 'nextAction' in value && 'pendingSteps' in value && 'status' in value;
}

export function isVerifyResult(value: unknown): value is VerifyResult {
	return isPlainObject(value) && 'results' in value && Array.isArray(value.results) && 'reportPath' in value;
}

export function isPRResult(value: unknown): value is PRResult {
	return isPlainObject(value) && 'content' in value && 'reportPath' in value;
}

export function isExecuteStepResult(value: unknown): value is ExecuteStepResult {
	return isPlainObject(value) && 'changedFiles' in value && 'summary' in value && 'warnings' in value;
}

export function isCommitStepResult(value: unknown): value is CommitStepResult {
	return isPlainObject(value) && 'stepId' in value && 'sha' in value && 'message' in value;
}

export function isTaskSnapshot(
	value: unknown
): value is { issue: unknown; plan: unknown; progress: ProgressState | null } {
	return isPlainObject(value) && 'issue' in value && 'plan' in value && 'progress' in value;
}
