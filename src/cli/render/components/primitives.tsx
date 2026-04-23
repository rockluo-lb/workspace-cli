import { Box, Text } from 'ink';
import type { Primitive, Tone } from '../types.js';
import { primitiveToString } from '../utils.js';

export function KV({ label, value, color }: { label: string; value: Primitive; color?: Tone }) {
	return (
		<Box>
			<Box width={18}>
				<Text color="cyan">{label}</Text>
			</Box>
			<Text color={color}>{primitiveToString(value)}</Text>
		</Box>
	);
}

export function Badge({ label, tone }: { label: string; tone: Exclude<Tone, 'gray'> }) {
	return <Text color={tone}>[{label}]</Text>;
}

export function BulletList({
	items,
	color = 'green',
	empty = '- none',
}: {
	items: string[];
	color?: Tone;
	empty?: string;
}) {
	if (items.length === 0) {
		return <Text color="gray">{empty}</Text>;
	}

	return (
		<>
			{items.map((item, index) => (
				<Text key={`${item}-${index}`} color={color}>
					- {item}
				</Text>
			))}
		</>
	);
}
