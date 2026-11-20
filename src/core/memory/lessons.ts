import fs from 'fs-extra';
import { createHash } from 'node:crypto';
import path from 'node:path';
import type { ExecutionPlan, LessonKind, LessonRecord } from '../shared/types.js';

export interface LessonCandidate {
	kind: LessonKind;
	text: string;
	source: string;
	/** 'global' applies in every repo; a workspace id limits the lesson to one repo. */
	scope: string;
}

type Lesson = LessonRecord;

const APPROVED_BRIEF_LIMIT = 8;
export const GLOBAL_LESSON_SCOPE = 'global';

/** Lessons written before scopes existed were global; keep that meaning for old data. */
export function lessonScope(lesson: Lesson): string {
	return lesson.scope ?? GLOBAL_LESSON_SCOPE;
}

export function lessonId(kind: LessonKind, text: string): string {
	const normalized = text.trim().replace(/\s+/g, ' ').toLowerCase();
	return createHash('sha1').update(`${kind}\n${normalized}`).digest('hex').slice(0, 12);
}

export function latestHandoffByStep(log: string): Array<{ stepId: number; text: string }> {
	const latest = new Map<number, string>();
	for (const chunk of log.split(/^## step /m).slice(1)) {
		const breakAt = chunk.indexOf('\n');
		const stepId = Number(breakAt === -1 ? chunk : chunk.slice(0, breakAt));
		const text = (breakAt === -1 ? '' : chunk.slice(breakAt + 1)).trim();
		if (Number.isInteger(stepId) && text.length > 0) {
			latest.set(stepId, text);
		}
	}
	return [...latest.entries()].sort((a, b) => a[0] - b[0]).map(([stepId, text]) => ({ stepId, text }));
}

export function renderHandoff(entries: Array<{ stepId: number; text: string }>): string {
	if (entries.length === 0) {
		return '';
	}
	return entries.map((entry) => `### Step ${entry.stepId}\n\n${entry.text.slice(0, 400)}`).join('\n\n');
}

export function candidatesFromTask(
	jiraKey: string,
	plan: ExecutionPlan,
	handoffLog: string,
	workspaceId: string
): LessonCandidate[] {
	const decisions = (plan.decisions ?? []).map((decision) => ({
		kind: 'decision' as const,
		text: `${decision.question} → ${decision.answer}`,
		source: `${jiraKey} plan.decisions`,
		scope: GLOBAL_LESSON_SCOPE,
	}));
	const notes = latestHandoffByStep(handoffLog).map((entry) => ({
		kind: 'review' as const,
		text: entry.text,
		source: `${jiraKey} logs/handoff.md step ${entry.stepId}`,
		scope: workspaceId,
	}));
	return [...decisions, ...notes];
}

export function mergeLessons(
	existing: Lesson[],
	jiraKey: string,
	candidates: LessonCandidate[]
): { lessons: Lesson[]; created: number; merged: number } {
	const lessons = existing.map((lesson) => ({ ...lesson, evidence: [...lesson.evidence] }));
	let created = 0;
	let merged = 0;
	for (const candidate of candidates) {
		const text = candidate.text.trim();
		if (text.length === 0) {
			continue;
		}
		const id = lessonId(candidate.kind, text);
		const found = lessons.find((lesson) => lesson.id === id);
		const evidence = { jiraKey, source: candidate.source };
		if (!found) {
			lessons.push({
				id,
				kind: candidate.kind,
				text,
				status: 'pending',
				scope: candidate.scope,
				evidence: [evidence],
			});
			created += 1;
			continue;
		}
		if (found.status === 'rejected') {
			continue;
		}
		if (!found.evidence.some((item) => item.jiraKey === jiraKey && item.source === candidate.source)) {
			found.evidence.push(evidence);
			merged += 1;
		}
	}
	return { lessons, created, merged };
}

export function approvedForBrief(lessons: Lesson[], workspaceId: string): Lesson[] {
	const rank: Record<LessonKind, number> = { decision: 0, review: 1, files: 2 };
	return lessons
		.filter(
			(lesson) =>
				lesson.status === 'approved' &&
				(lessonScope(lesson) === GLOBAL_LESSON_SCOPE || lessonScope(lesson) === workspaceId)
		)
		.sort((a, b) => rank[a.kind] - rank[b.kind])
		.slice(0, APPROVED_BRIEF_LIMIT);
}

export function lessonsPath(stateBaseDir: string): string {
	return path.join(stateBaseDir, 'lessons.json');
}

export async function loadLessons(stateBaseDir: string): Promise<Lesson[]> {
	const filePath = lessonsPath(stateBaseDir);
	if (!(await fs.pathExists(filePath))) {
		return [];
	}
	const raw = (await fs.readJson(filePath)) as { lessons?: Lesson[] };
	return raw.lessons ?? [];
}

export async function saveLessons(stateBaseDir: string, lessons: Lesson[]): Promise<void> {
	await fs.ensureDir(stateBaseDir);
	await fs.writeJson(lessonsPath(stateBaseDir), { lessons }, { spaces: 2 });
}
