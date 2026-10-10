import type { FigmaDesignContext, FigmaProvider, FigmaReference } from '../../shared/types.js';
import { loadFixtureMap } from '../provider-utils.js';

const FIGMA_URL = /figma\.com\/(?:file|design|proto)\/([^/?]+)(?:\/[^?]*)?(?:\?(.*))?/;

export class FigmaMcpProvider implements FigmaProvider {
	async parseUrl(url: string): Promise<FigmaReference> {
		const match = url.match(FIGMA_URL);
		const query = new URL(url).searchParams;
		return {
			url,
			fileId: match?.[1],
			nodeId: query.get('node-id') ?? undefined,
			mode: url.includes('/proto/') ? 'proto' : url.includes('/design/') ? 'design' : 'file',
		};
	}

	async resolveContext(ref: FigmaReference): Promise<FigmaDesignContext> {
		const fixtures = await loadFixtureMap<FigmaDesignContext>('VIBE_FIGMA_FIXTURES');
		const fixture = fixtures?.[ref.url];
		if (fixture) {
			return fixture;
		}

		const layoutHints = ['Use existing spacing tokens', 'Preserve current component patterns'];
		if (!ref.nodeId) {
			layoutHints.unshift(
				'No Figma node selected. Resolve a frame node before implementing; file-level context is metadata only.'
			);
		}
		return {
			title: 'Synthetic Figma Context',
			fileId: ref.fileId,
			nodeId: ref.nodeId,
			pageName: 'Mock Page',
			nodeName: 'Mock Node',
			texts: ['Synthetic design text'],
			components: ['Card', 'Form', 'Button'],
			layoutHints,
			partial: true,
		};
	}
}
