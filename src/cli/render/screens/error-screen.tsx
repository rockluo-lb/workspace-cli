import { Newline, Text } from 'ink';
import { ScreenFrame, Section } from '../components/layout.js';
import { Badge, KV } from '../components/primitives.js';

export function ErrorScreen({ code, message, details }: { code: string; message: string; details?: string }) {
	return (
		<ScreenFrame title="Vibe Flow Error" eyebrow={code}>
			<Badge label="action required" tone="red" />
			<Section title="Summary">
				<KV label="Code" value={code} color="red" />
				<KV label="Message" value={message} />
			</Section>
			{details ? (
				<Section title="Details">
					<Text color="gray">{details}</Text>
				</Section>
			) : null}
			<Text>
				<Newline />
			</Text>
		</ScreenFrame>
	);
}
