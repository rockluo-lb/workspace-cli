import type { OpenQuestion, PlanReview, PlanReviewInput, PlanReviewer } from '../shared/types.js';

const TBD_TOKENS = ['tbd', 'todo', '待定', '待确认', '不确定', 'unclear', 'unknown', '?', '待补充'];
const DIVERGENCE_TOKENS = ['差异', 'divergence', 'inconsistent', '冲突', 'conflict', '不一致', '歧义', 'ambiguous'];

function hasUncertainWording(text: string | undefined): boolean {
	if (!text) {
		return false;
	}
	const lower = text.toLowerCase();
	return TBD_TOKENS.some((token) => lower.includes(token));
}

function hasDivergenceWording(text: string | undefined): boolean {
	if (!text) {
		return false;
	}
	const lower = text.toLowerCase();
	return DIVERGENCE_TOKENS.some((token) => lower.includes(token));
}

export class HeuristicPlanReviewer implements PlanReviewer {
	review(input: PlanReviewInput): PlanReview {
		const { plan, repoContext, issue, links, config, iteration } = input;
		const openQuestions: OpenQuestion[] = [];
		const signals: string[] = [];
		let score = 0;

		const addQuestion = (question: OpenQuestion): void => {
			openQuestions.push(question);
			score += question.weight;
		};

		for (const risk of plan.risks) {
			addQuestion({
				category: 'divergence',
				prompt: `如何应对已识别的风险：「${risk}」？是否需要调整对应步骤或补充上下文？`,
				weight: hasDivergenceWording(risk) ? 0.18 : 0.12,
			});
		}

		for (const assumption of plan.assumptions) {
			const weight = hasUncertainWording(assumption) ? 0.15 : 0.08;
			addQuestion({
				category: 'design',
				prompt: `请确认假设是否成立：「${assumption}」。若不成立，计划需要如何修改？`,
				weight,
			});
		}

		for (const step of plan.steps) {
			if (step.expectedFiles.length === 0) {
				addQuestion({
					category: 'scope',
					prompt: `步骤 ${step.id}「${step.title}」尚未确定要改动的文件，请补充预期文件范围。`,
					relatedStepId: step.id,
					weight: 0.15,
				});
			}
			if (hasUncertainWording(step.description) || hasUncertainWording(step.title)) {
				addQuestion({
					category: 'scope',
					prompt: `步骤 ${step.id}「${step.title}」描述中存在待确认信息，请明确具体实现方式。`,
					relatedStepId: step.id,
					weight: 0.12,
				});
			}
			if (hasDivergenceWording(step.description)) {
				addQuestion({
					category: 'divergence',
					prompt: `步骤 ${step.id}「${step.title}」涉及差异化/冲突点，请确认在各目标环境下的处理方式。`,
					relatedStepId: step.id,
					weight: 0.15,
				});
			}
			if (step.verifyCommands.length === 0) {
				addQuestion({
					category: 'verification',
					prompt: `步骤 ${step.id}「${step.title}」缺少验证命令，请补充如何验证该步骤。`,
					relatedStepId: step.id,
					weight: 0.1,
				});
			}
		}

		if (repoContext.partial) {
			addQuestion({
				category: 'context',
				prompt: '仓库上下文分析不完整，请确认技术栈、目录结构等关键信息，避免计划基于错误假设。',
				weight: 0.2,
			});
			signals.push('repoContext.partial=true');
		}

		const figmaLinks = links.filter((link) => link.type === 'figma');
		if (figmaLinks.length === 0 && /ui|界面|页面|design|figma|视觉|样式/i.test(issue.summary)) {
			addQuestion({
				category: 'context',
				prompt: 'Jira issue 涉及 UI/视觉改动，但未解析到 Figma 设计上下文，请补充设计链接或确认视觉规范。',
				weight: 0.18,
			});
		}

		if (issue.acceptanceCriteria.length === 0) {
			addQuestion({
				category: 'divergence',
				prompt: 'Jira issue 缺少明确的验收标准，请与用户确认完成的判定条件。',
				weight: 0.15,
			});
			signals.push('acceptanceCriteria=empty');
		}

		const uncertaintyScore = Number(Math.min(score, 1).toFixed(2));
		const threshold = config.review.uncertaintyThreshold;
		const reachedMaxIterations = iteration >= config.review.maxIterations;
		const approved = uncertaintyScore <= threshold || reachedMaxIterations;

		if (reachedMaxIterations && uncertaintyScore > threshold) {
			signals.push(`reached max review iterations (${config.review.maxIterations}); forcing approval`);
		}

		signals.push(`score=${uncertaintyScore} threshold=${threshold} questions=${openQuestions.length}`);

		return {
			jiraKey: input.jiraKey,
			uncertaintyScore,
			threshold,
			approved,
			openQuestions: openQuestions.sort((a, b) => b.weight - a.weight),
			signals,
			iteration,
		};
	}
}
