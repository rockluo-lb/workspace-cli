import { Box, Text } from 'ink';
import type { ExecuteStepResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, BulletList } from '../components/primitives.js';

export function ExecuteStepScreen({ title, result }: { title: string; result: ExecuteStepResult }) {
	const stepLabel = title.replace(/^Execute Step\s*/, '') || 'Step';
	const checks = result.verifyResults ?? [];
	return (
		<ScreenFrame title={title} eyebrow={stepLabel}>
			<Box>
				<Badge label={`${result.changedFiles.length} files`} tone="cyan" />
				<Text> </Text>
				<Badge label={`${checks.length} checks`} tone={checks.length > 0 ? 'green' : 'yellow'} />
			</Box>
			<Section title="Summary">
				<Text>{result.summary}</Text>
			</Section>
			<Section title="Changed Files">
				<BulletList items={result.changedFiles} />
			</Section>
			<Section title="Warnings">
				<BulletList items={result.warnings} color="yellow" />
			</Section>
			<Section title="Verification">
				{checks.length === 0 ? (
					<Text color="gray">- no verification results</Text>
				) : (
					checks.map((item) => (
						<Text key={item.command} color={item.code === 0 ? 'green' : 'red'}>
							- {item.code === 0 ? 'PASS' : 'FAIL'} {item.command}
						</Text>
					))
				)}
			</Section>
		</ScreenFrame>
	);
}
