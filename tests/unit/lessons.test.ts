import { describe, expect, it } from 'vitest';
import {
	approvedForBrief,
	candidatesFromTask,
	GLOBAL_LESSON_SCOPE,
	latestHandoffByStep,
	lessonId,
	mergeLessons,
} from '../../src/core/memory/lessons.js';
import type { ExecutionPlan } from '../../src/core/shared/types.js';

const workspace = 'workspace-abc';

const makePlan = (): ExecutionPlan => ({
	jiraKey: 'CRMCN-2',
	branch: 'feat/CRMCN-2',
	summary: 'test',
	assumptions: [],
	risks: [],
	decisions: [{ question: 'Keep pagination?', answer: 'Yes' }],
	steps: [
		{
			id: 1,
			title: 'Edit list',
			description: 'edit',
			expectedFiles: ['src/a.ts'],
			verifyCommands: [],
			commitMessage: 'chore: edit',
			status: 'pending',
		},
	],
});

describe('task memory', () => {
	it('keeps the latest handoff note for a step', () => {
		const entries = latestHandoffByStep('## step 1\nfirst\n\n## step 2\nsecond\n\n## step 1\nrevised\n');
		expect(entries).toEqual([
			{ stepId: 1, text: 'revised' },
			{ stepId: 2, text: 'second' },
		]);
	});

	it('produces only decision and handoff candidates, never committed-file lists', () => {
		const candidates = candidatesFromTask('CRMCN-2', makePlan(), '## step 1\nEdited the list view.\n', workspace);
		expect(candidates).toHaveLength(2);
		expect(candidates.find((c) => c.kind === 'decision')).toMatchObject({
			text: 'Keep pagination? → Yes',
			scope: GLOBAL_LESSON_SCOPE,
		});
		expect(candidates.find((c) => c.kind === 'review')).toMatchObject({
			text: 'Edited the list view.',
			scope: workspace,
		});
		expect(candidates.some((c) => c.kind === 'files')).toBe(false);
	});

	it('merges a repeated lesson and leaves a rejected one alone', () => {
		const candidate = {
			kind: 'decision' as const,
			text: 'Keep pagination? → Yes',
			source: 'CRMCN-2 plan.decisions',
			scope: GLOBAL_LESSON_SCOPE,
		};
		const id = lessonId(candidate.kind, candidate.text);
		const first = mergeLessons([], 'CRMCN-1', [{ ...candidate, source: 'CRMCN-1 plan.decisions' }]);
		expect(first.created).toBe(1);
		expect(first.lessons[0]?.status).toBe('pending');
		expect(first.lessons[0]?.scope).toBe(GLOBAL_LESSON_SCOPE);

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

	it('injects only global and current-workspace approved lessons into a brief', () => {
		const base = (over: { id: string; text: string; scope: string | undefined }) => ({
			id: over.id,
			kind: 'decision' as const,
			text: over.text,
			status: 'approved' as const,
			scope: over.scope as string,
			evidence: [],
		});
		const lessons = [
			base({ id: 'g', text: 'global rule', scope: GLOBAL_LESSON_SCOPE }),
			base({ id: 'w', text: 'this workspace rule', scope: workspace }),
			base({ id: 'o', text: 'other workspace rule', scope: 'other-ws' }),
		];
		const visible = approvedForBrief(lessons, workspace);
		expect(visible.map((l) => l.text)).toEqual(['global rule', 'this workspace rule']);
		expect(visible.some((l) => l.text === 'other workspace rule')).toBe(false);

		// legacy lessons with no scope are treated as global
		const legacy = [
			{ ...base({ id: 'l', text: 'legacy', scope: undefined }), scope: undefined },
		] as unknown as Parameters<typeof approvedForBrief>[0];
		expect(approvedForBrief(legacy, workspace).map((l) => l.text)).toEqual(['legacy']);
	});
});
