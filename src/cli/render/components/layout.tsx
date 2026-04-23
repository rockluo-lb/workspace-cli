import { Box, Text } from 'ink';
import React from 'react';

export function ScreenFrame({
	title,
	eyebrow,
	children,
}: {
	title: string;
	eyebrow?: string;
	children: React.ReactNode;
}) {
	return (
		<Box flexDirection="column">
			{eyebrow ? <Text color="cyan">{eyebrow}</Text> : null}
			<Text bold color="green">
				{title}
			</Text>
			<Text color="gray">{'='.repeat(Math.max(title.length, 14))}</Text>
			<Box flexDirection="column" marginTop={1}>
				{children}
			</Box>
		</Box>
	);
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
	return (
		<Box flexDirection="column" marginTop={1}>
			<Text bold color="yellow">
				{title}
			</Text>
			<Box flexDirection="column" paddingLeft={2}>
				{children}
			</Box>
		</Box>
	);
}
