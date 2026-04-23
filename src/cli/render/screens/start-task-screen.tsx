import { Box } from 'ink';
import type { StartTaskResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, BulletList, KV } from '../components/primitives.js';

export function StartTaskScreen({ result }: { result: StartTaskResult }) {
	return (
		<ScreenFrame title="Start Task" eyebrow={result.jiraKey}>
			<Box>
				<Badge label="branch created" tone="green" />
			</Box>
			<Section title="Branch Flow">
				<KV label="Initial" value={result.initialBranch} />
				<KV label="Base" value={result.baseBranch} />
				<KV label="Created" value={result.branch} color="green" />
				<KV label="Current" value={result.currentBranch} color="green" />
			</Section>
			<Section title="Workspace">
				<KV label="Task Dir" value={result.taskDir} />
			</Section>
			<Section title="Warnings">
				<BulletList items={result.warnings} color="yellow" />
			</Section>
		</ScreenFrame>
	);
}
