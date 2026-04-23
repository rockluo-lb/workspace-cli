import { Box, Text } from 'ink';
import type { ResumeResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, BulletList } from '../components/primitives.js';
import { statusColor } from '../utils.js';

export function ResumeScreen({ result }: { result: ResumeResult }) {
	return (
		<ScreenFrame title="Resume Task" eyebrow={result.jiraKey}>
			<Box>
				<Badge label={result.status} tone={statusColor(result.status)} />
			</Box>
			<Section title="Next Action">
				<Text color="green">{result.nextAction}</Text>
			</Section>
			<Section title="Pending Steps">
				<BulletList items={result.pendingSteps.map((step) => `step ${step}`)} />
			</Section>
		</ScreenFrame>
	);
}
