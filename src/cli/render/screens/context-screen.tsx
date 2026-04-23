import { Box, Text } from 'ink';
import type { ContextResult } from '../../../core/shared/types.js';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, BulletList, KV } from '../components/primitives.js';

export function ContextScreen({ result }: { result: ContextResult }) {
	return (
		<ScreenFrame title="Build Context" eyebrow={result.jiraKey}>
			<Box>
				<Badge label={result.repoContext.repoName} tone="cyan" />
				<Text> </Text>
				<Badge label={result.repoContext.workspaceType} tone="green" />
			</Box>
			<Section title="Repository">
				<KV label="Repo" value={result.repoContext.repoName} />
				<KV label="Package Mgr" value={result.repoContext.packageManager} />
				<KV label="Workspace" value={result.repoContext.workspaceType} />
				<KV label="UI" value={result.repoContext.uiFramework ?? '-'} />
				<KV label="API Pattern" value={result.repoContext.apiPattern ?? '-'} />
			</Section>
			<Section title="Coverage">
				<KV label="Apps" value={result.repoContext.apps.length} />
				<KV label="Packages" value={result.repoContext.packages.length} />
				<KV label="Routes" value={result.repoContext.routes.length} />
				<KV label="Tests" value={result.repoContext.testTools.join(', ') || '-'} />
				<KV label="Report" value={result.reportPath} />
			</Section>
			<Section title="Warnings">
				<BulletList items={result.warnings} color="yellow" />
			</Section>
		</ScreenFrame>
	);
}
