import { Box, Text } from 'ink';
import type { PlanResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, KV } from '../components/primitives.js';

export function PlanScreen({ result }: { result: PlanResult }) {
	return (
		<ScreenFrame title="Generate Plan" eyebrow={result.jiraKey}>
			<Box>
				<Badge label={`${result.plan.steps.length} steps`} tone="green" />
				<Text> </Text>
				<Badge label={result.plan.branch} tone="cyan" />
			</Box>
			<Section title="Summary">
				<Text>{result.plan.summary}</Text>
			</Section>
			<Section title="Plan Health">
				<KV label="Report" value={result.reportPath} />
				<KV label="Steps" value={result.plan.steps.length} />
				<KV label="Assumptions" value={result.plan.assumptions.length} />
				<KV label="Risks" value={result.plan.risks.length} />
			</Section>
			<Section title="Steps">
				{result.plan.steps.map((step) => (
					<Box key={step.id} flexDirection="column" marginBottom={1}>
						<Text color="green">
							#{step.id} {step.title}
						</Text>
						<Text color="gray">{step.description}</Text>
						<Text color="gray">
							files {step.expectedFiles.length} | checks {step.verifyCommands.length} | {step.status}
						</Text>
					</Box>
				))}
			</Section>
		</ScreenFrame>
	);
}
