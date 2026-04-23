import { Box } from 'ink';
import type { ProgressState } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, KV } from '../components/primitives.js';
import { isPlainObject, statusColor } from '../utils.js';

export function SnapshotScreen({
	value,
}: {
	value: { issue: unknown; plan: unknown; progress: ProgressState | null };
}) {
	const progress = value.progress;
	const planSteps = isPlainObject(value.plan) && Array.isArray(value.plan.steps) ? value.plan.steps.length : 0;
	const issueKey = isPlainObject(value.issue) && typeof value.issue.key === 'string' ? value.issue.key : 'unknown';

	return (
		<ScreenFrame title="Task Snapshot" eyebrow={issueKey}>
			<Box>
				<Badge label={progress?.status ?? 'unknown'} tone={statusColor(progress?.status ?? 'unknown')} />
			</Box>
			<Section title="State">
				<KV label="Branch" value={progress?.branch} />
				<KV label="Current Step" value={progress?.currentStep} />
				<KV label="Completed" value={progress?.completedSteps.length ?? 0} />
				<KV label="Commits" value={progress?.commits.length ?? 0} />
			</Section>
			<Section title="Artifacts">
				<KV label="Issue Loaded" value={value.issue ? 'yes' : 'no'} />
				<KV label="Plan Steps" value={planSteps} />
			</Section>
		</ScreenFrame>
	);
}
