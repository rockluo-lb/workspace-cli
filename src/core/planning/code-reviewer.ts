import type {
	CodeReview,
	CodeReviewFinding,
	CodeReviewInput,
	CodeReviewer,
	DiffStat,
} from '../shared/types.js';

const ABSTRACTION_SMELL_PATTERN =
	/(abstract|factory|manager|wrapper|provider-base|base-[a-z]+|strategy|adapter|helper|utils?)\.(ts|tsx|js|jsx)$/i;
const TEST_FILE_PATTERN = /(\.(test|spec)\.(ts|tsx|js|jsx)$|(^|\/)(tests?|__tests__)\/)/i;
const SOURCE_FILE_PATTERN = /\.(ts|tsx|js|jsx)$/i;
const DEPENDENCY_MANIFEST_PATTERN = /(^|\/)package\.json$/i;
const MISSING_TEST_INSERTION_FLOOR = 80;

function normalize(file: string): string {
	return file.replace(/\\/g, '/');
}

function totalInsertions(diffStats: DiffStat[]): number {
	return diffStats.reduce((sum, stat) => sum + stat.insertions, 0);
}

function isPureAddition(stat: DiffStat): boolean {
	return stat.insertions > 0 && stat.deletions === 0;
}

export class HeuristicCodeReviewer implements CodeReviewer {
	review(input: CodeReviewInput): CodeReview {
		const { step, changedFiles, diffStats, repoContext, scopeResult, config, iteration } = input;
		const findings: CodeReviewFinding[] = [];
		const signals: string[] = [];
		let score = 0;

		const addFinding = (finding: CodeReviewFinding): void => {
			findings.push(finding);
			score += finding.weight;
		};

		const files = changedFiles.map(normalize);
		const insertions = totalInsertions(diffStats);
		const pureAdditions = diffStats.filter(isPureAddition);

		for (const error of scopeResult.errors) {
			addFinding({
				category: 'scope',
				message: `改动超出步骤范围：${error}`,
				weight: 0.3,
			});
		}
		for (const warning of scopeResult.warnings) {
			addFinding({
				category: 'scope',
				message: `范围提示：${warning}`,
				weight: 0.05,
			});
		}

		if (pureAdditions.length > config.codeReview.maxNewFiles) {
			addFinding({
				category: 'over-engineering',
				message: `本步骤纯新增 ${pureAdditions.length} 个文件（阈值 ${config.codeReview.maxNewFiles}）。请确认是否存在不必要的分层或提前抽象，能否合并到现有文件。`,
				weight: 0.2,
			});
		}

		if (insertions > config.codeReview.maxInsertions) {
			addFinding({
				category: 'complexity',
				message: `本步骤新增 ${insertions} 行（阈值 ${config.codeReview.maxInsertions}）。请确认是否可以拆分步骤或删减非必要实现。`,
				weight: 0.2,
			});
		}

		const largeFileFloor = Math.ceil(config.codeReview.maxInsertions / 2);
		for (const stat of diffStats) {
			if (stat.insertions > largeFileFloor) {
				addFinding({
					category: 'complexity',
					message: `单文件新增 ${stat.insertions} 行，超过单文件建议上限 ${largeFileFloor}，请检查是否职责过多。`,
					file: normalize(stat.file),
					weight: 0.15,
				});
			}
		}

		for (const file of files) {
			if (ABSTRACTION_SMELL_PATTERN.test(file) && pureAdditions.some((stat) => normalize(stat.file) === file)) {
				addFinding({
					category: 'over-engineering',
					message: '新增了疑似抽象层文件，请确认当前需求是否真的需要该抽象（YAGNI），能否直接内联实现。',
					file,
					weight: 0.15,
				});
			}
		}

		const manifestChanged = files.filter((file) => DEPENDENCY_MANIFEST_PATTERN.test(file));
		for (const file of manifestChanged) {
			addFinding({
				category: 'dependency',
				message: `改动了依赖清单，请确认新增依赖是必要的，且没有可复用的现有依赖（现有依赖：${repoContext.conventions?.dependencies.slice(0, 8).join(', ') || '未采集'}）。`,
				file,
				weight: 0.15,
			});
		}

		const conventions = repoContext.conventions;
		if (conventions) {
			const stepVerify = step.verifyCommands.join(' ');
			const lintScripts = conventions.scripts.filter((script) => /lint|typecheck|format/.test(script));
			if (conventions.lintTools.length > 0 && lintScripts.length > 0) {
				const covered = lintScripts.some((script) => stepVerify.includes(script));
				if (!covered) {
					addFinding({
						category: 'convention',
						message: `项目配置了 ${conventions.lintTools.join('/')}，但步骤验证命令未覆盖 ${lintScripts.join(' / ')}，请按项目规范补充验证。`,
						weight: 0.1,
					});
				}
			}

			if (conventions.cursorRules.length > 0) {
				signals.push(`cursorRules=${conventions.cursorRules.join(', ')}`);
			}
			if (conventions.hasAgentsMd) {
				signals.push('AGENTS.md present');
			}
			if (conventions.tsStrict) {
				signals.push('tsconfig strict=true');
			}
		}

		const touchedSource = files.some((file) => SOURCE_FILE_PATTERN.test(file) && !TEST_FILE_PATTERN.test(file));
		const touchedTest = files.some((file) => TEST_FILE_PATTERN.test(file));
		if (
			touchedSource &&
			!touchedTest &&
			insertions >= MISSING_TEST_INSERTION_FLOOR &&
			repoContext.testTools.length > 0
		) {
			addFinding({
				category: 'convention',
				message: `新增 ${insertions} 行源码但未改动任何测试，项目已配置 ${repoContext.testTools.join('/')}，请补充或说明为何不需要测试。`,
				weight: 0.12,
			});
		}

		const riskScore = Number(Math.min(score, 1).toFixed(2));
		const threshold = config.codeReview.riskThreshold;
		const reachedMaxIterations = iteration >= config.codeReview.maxIterations;
		const passed = riskScore <= threshold || reachedMaxIterations;

		if (reachedMaxIterations && riskScore > threshold) {
			signals.push(`reached max code review iterations (${config.codeReview.maxIterations}); forcing pass`);
		}

		signals.push(
			`score=${riskScore} threshold=${threshold} findings=${findings.length} files=${files.length} insertions=${insertions}`
		);

		return {
			jiraKey: input.jiraKey,
			stepId: step.id,
			riskScore,
			threshold,
			passed,
			findings: findings.sort((a, b) => b.weight - a.weight),
			signals,
			iteration,
		};
	}
}
