import { Box } from 'ink';
import type { CommitStepResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, KV } from '../components/primitives.js';

export function CommitStepScreen({ title, result }: { title: string; result: CommitStepResult }) {
	return (
		<ScreenFrame title={title} eyebrow={result.jiraKey}>
			<Box>
				<Badge label={`step ${result.stepId}`} tone="cyan" />
				<Badge label="committed" tone="green" />
			</Box>
			<Section title="Commit">
				<KV label="SHA" value={result.sha} color="green" />
				<KV label="Message" value={result.message} />
			</Section>
		</ScreenFrame>
	);
}
