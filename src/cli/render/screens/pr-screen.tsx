import { Box } from 'ink';
import type { PRResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, BulletList, KV } from '../components/primitives.js';

export function PRScreen({ result }: { result: PRResult }) {
	const preview = result.content.split('\n').filter(Boolean).slice(0, 8);

	return (
		<ScreenFrame title="Prepare PR" eyebrow={result.jiraKey}>
			<Box>
				<Badge label="draft ready" tone="green" />
			</Box>
			<Section title="Artifact">
				<KV label="Report" value={result.reportPath} />
			</Section>
			<Section title="PR Preview">
				<BulletList items={preview} color="gray" empty="- empty preview" />
			</Section>
		</ScreenFrame>
	);
}
