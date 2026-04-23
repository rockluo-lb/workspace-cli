import { Box, Text } from 'ink';
import type { Primitive } from '../types.js';
import { isPlainObject, primitiveToString, titleFromKey } from '../utils.js';
import { Section } from './layout.js';
import { KV } from './primitives.js';

function JsonBlock({ value }: { value: unknown }) {
	return (
		<Box marginTop={1}>
			<Text color="gray">{JSON.stringify(value, null, 2)}</Text>
		</Box>
	);
}

function ArraySection({ label, items }: { label: string; items: unknown[] }) {
	return (
		<Section title={label}>
			{items.length === 0 ? (
				<Text color="gray">- none</Text>
			) : (
				items.map((item, index) => (
					<Box key={`${label}-${index}`} flexDirection="column" marginBottom={1}>
						{isPlainObject(item) || Array.isArray(item) ? (
							<>
								<Text color="green">- item {index + 1}</Text>
								<Box paddingLeft={2}>
									<DataNode value={item} />
								</Box>
							</>
						) : (
							<Text color="green">- {primitiveToString(item as Primitive)}</Text>
						)}
					</Box>
				))
			)}
		</Section>
	);
}

function ObjectSection({ label, value }: { label: string; value: Record<string, unknown> }) {
	const primitiveEntries = Object.entries(value).filter(
		([, entry]) => !isPlainObject(entry) && !Array.isArray(entry)
	);
	const nestedEntries = Object.entries(value).filter(([, entry]) => isPlainObject(entry) || Array.isArray(entry));

	return (
		<Section title={label}>
			{primitiveEntries.length === 0 && nestedEntries.length === 0 ? <Text color="gray">- empty</Text> : null}
			{primitiveEntries.map(([key, entry]) => (
				<KV key={key} label={titleFromKey(key)} value={entry as Primitive} />
			))}
			{nestedEntries.map(([key, entry]) => (
				<Box key={key} marginTop={1}>
					<DataNode label={titleFromKey(key)} value={entry} />
				</Box>
			))}
		</Section>
	);
}

export function DataNode({ label, value }: { label?: string; value: unknown }) {
	if (Array.isArray(value)) {
		return <ArraySection label={label ?? 'Items'} items={value} />;
	}

	if (isPlainObject(value)) {
		return <ObjectSection label={label ?? 'Details'} value={value} />;
	}

	if (label) {
		return <KV label={label} value={value as Primitive} />;
	}

	return <JsonBlock value={value} />;
}
