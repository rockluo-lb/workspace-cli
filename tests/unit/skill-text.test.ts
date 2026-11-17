import { describe, expect, it } from 'vitest';
import { loadSkillText } from '../../src/cli/skill-text.js';

describe('vibe skill', () => {
	it('prints the agent prerequisite guide', async () => {
		const skill = await loadSkillText();
		expect(skill).toContain('Run `vibe skill`');
		expect(skill).toContain('plan → review → plan');
		expect(skill).toContain('VERIFY_FAILED');
		expect(skill).toContain('vibe pr');
		expect(skill).toContain('## Multi-Agent Roles');
		expect(skill).toContain('Branch review sub-agent');
		expect(skill).toContain('verify sub-agent');
		expect(skill).toContain('### Sub-agent model selection');
		expect(skill).toContain('Reasoning effort never goes above High');
	});
});
