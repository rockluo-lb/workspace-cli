import { CapabilityUnavailableError } from '../../shared/errors.js';
import type { FigmaDesignContext, FigmaProvider, FigmaReference } from '../../shared/types.js';

export class FigmaPluginProvider implements FigmaProvider {
	async parseUrl(url: string): Promise<FigmaReference> {
		return { url };
	}

	async resolveContext(_ref: FigmaReference): Promise<FigmaDesignContext> {
		throw new CapabilityUnavailableError('Figma plugin provider is not implemented in the MVP.');
	}
}
