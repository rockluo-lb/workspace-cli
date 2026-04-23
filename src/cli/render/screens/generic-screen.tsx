import { DataNode } from '../components/data-node.js';
import { ScreenFrame } from '../components/layout.js';

export function GenericScreen({ title, value }: { title: string; value: unknown }) {
	return (
		<ScreenFrame title={title}>
			<DataNode value={value} />
		</ScreenFrame>
	);
}
