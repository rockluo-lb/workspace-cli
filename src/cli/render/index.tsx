import { Newline, Text, renderToString } from 'ink';
import {
	isCommitStepResult,
	isContextResult,
	isExecuteStepResult,
	isPRResult,
	isPlanResult,
	isResumeResult,
	isStartTaskResult,
	isTaskSnapshot,
	isVerifyResult,
} from './guards.js';
import { CommitStepScreen } from './screens/commit-step-screen.js';
import { ContextScreen } from './screens/context-screen.js';
import { ErrorScreen } from './screens/error-screen.js';
import { ExecuteStepScreen } from './screens/execute-step-screen.js';
import { GenericScreen } from './screens/generic-screen.js';
import { PlanScreen } from './screens/plan-screen.js';
import { PRScreen } from './screens/pr-screen.js';
import { ResumeScreen } from './screens/resume-screen.js';
import { SnapshotScreen } from './screens/snapshot-screen.js';
import { StartTaskScreen } from './screens/start-task-screen.js';
import { VerifyScreen } from './screens/verify-screen.js';

export function renderValueScreen(title: string, value: unknown): string {
	const body = (() => {
		if (title === 'Start Task' && isStartTaskResult(value)) {
			return <StartTaskScreen result={value} />;
		}
		if (title === 'Build Context' && isContextResult(value)) {
			return <ContextScreen result={value} />;
		}
		if (title === 'Generate Plan' && isPlanResult(value)) {
			return <PlanScreen result={value} />;
		}
		if (title === 'Resume Task' && isResumeResult(value)) {
			return <ResumeScreen result={value} />;
		}
		if (title.startsWith('Execute Step') && isExecuteStepResult(value)) {
			return <ExecuteStepScreen title={title} result={value} />;
		}
		if (title.startsWith('Commit Step') && isCommitStepResult(value)) {
			return <CommitStepScreen title={title} result={value} />;
		}
		if (title === 'Verify Task' && isVerifyResult(value)) {
			return <VerifyScreen result={value} />;
		}
		if (title === 'Prepare PR' && isPRResult(value)) {
			return <PRScreen result={value} />;
		}
		if (title === 'Task Snapshot' && isTaskSnapshot(value)) {
			return <SnapshotScreen value={value} />;
		}
		return <GenericScreen title={title} value={value} />;
	})();

	return renderToString(
		<>
			{body}
			<Text>
				<Newline />
			</Text>
		</>
	);
}

export function renderErrorScreen(code: string, message: string, details?: string): string {
	return renderToString(<ErrorScreen code={code} message={message} details={details} />);
}
