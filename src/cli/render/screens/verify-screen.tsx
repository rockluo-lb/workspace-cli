import { Box, Text } from 'ink';
import type { VerifyResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, KV } from '../components/primitives.js';

export function VerifyScreen({ result }: { result: VerifyResult }) {
	const passed = result.results.filter((item) => item.code === 0).length;
	const failed = result.results.length - passed;

	return (
		<ScreenFrame title="Verify Task" eyebrow={result.jiraKey}>
			<Box>
				<Badge label={`${passed} passed`} tone="green" />
				<Text> </Text>
				<Badge label={`${failed} failed`} tone={failed > 0 ? 'red' : 'cyan'} />
			</Box>
			<Section title="Verification Summary">
				<KV label="Report" value={result.reportPath} />
				<KV label="Commands" value={result.results.length} />
			</Section>
			<Section title="Checks">
				{result.results.map((item) => (
					<Box key={item.command} flexDirection="column" marginBottom={1}>
						<Text color={item.code === 0 ? 'green' : 'red'}>
							{item.code === 0 ? 'PASS' : 'FAIL'} {item.command}
						</Text>
						{item.stderr ? <Text color="gray">{item.stderr}</Text> : null}
					</Box>
				))}
			</Section>
		</ScreenFrame>
	);
}
