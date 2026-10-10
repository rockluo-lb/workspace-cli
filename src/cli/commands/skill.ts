import type { Command } from 'commander';
import process from 'node:process';
import { loadSkillText } from '../skill-text.js';

export function registerSkillCommand(program: Command): void {
	program
		.command('skill')
		.description('Print the vibe-cli skill agents must follow before any other command')
		.action(async () => {
			const skill = await loadSkillText();
			process.stdout.write(skill.endsWith('\n') ? skill : `${skill}\n`);
		});
}
