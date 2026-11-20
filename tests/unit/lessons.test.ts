import { describe, expect, it } from 'vitest';
import { latestHandoffByStep, lessonId, mergeLessons } from '../../src/core/memory/lessons.js';

describe('task memory', () => {
	it('keeps the latest handoff note for a step', () => {
		const entries = latestHandoffByStep('## step 1\nfirst\n\n## step 2\nsecond\n\n## step 1\nrevised\n');
		expect(entries).toEqual([
			{ stepId: 1, text: 'revised' },
			{ stepId: 2, text: 'second' },
		]);
	});

	it('merges a repeated lesson and leaves a rejected one alone', () => {
		const candidate = {
			kind: 'decision' as const,
			text: 'Keep pagination? → Yes',
			source: 'CRMCN-2 plan.decisions',
		};
		const id = lessonId(candidate.kind, candidate.text);
		const first = mergeLessons([], 'CRMCN-1', [{ ...candidate, source: 'CRMCN-1 plan.decisions' }]);
		expect(first.created).toBe(1);
		expect(first.lessons[0]?.status).toBe('pending');

		const again = mergeLessons(first.lessons, 'CRMCN-2', [candidate]);
		expect(again.created).toBe(0);
		expect(again.merged).toBe(1);
		expect(again.lessons.filter((lesson) => lesson.id === id)).toHaveLength(1);

		const rejected = mergeLessons(
			first.lessons.map((lesson) => ({ ...lesson, status: 'rejected' as const })),
			'CRMCN-2',
			[candidate]
		);
		expect(rejected.created).toBe(0);
		expect(rejected.merged).toBe(0);
	});
});
