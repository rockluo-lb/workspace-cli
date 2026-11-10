# Vibe-CLI Skill Guide for AI Agents

Run `vibe skill` and follow this guide before any other `vibe` command. The command prints this document. Do not start, plan, review, or commit through vibe-cli until you have read it.

## Overview

`vibe-cli` is a Jira-driven step-based vibe coding workflow CLI. It orchestrates the full lifecycle of a development task: from Jira issue analysis, through planning and execution, to PR generation. As an AI agent, you use vibe-cli to manage structured, auditable, and incremental code changes tied to Jira tickets.

**Binary:** `vibe` (run from the project root directory)

---

## Workflow Lifecycle

```
start → context → ┌─────────────────────────────┐ → per step: ┌──────────────────────────────┐ → verify → pr (draft only)
                  │  plan → review → plan (loop) │             │ code → code-review → code    │
                  └─────────────────────────────┘             │ (loop) → commit when passed  │
                     until uncertainty is low                  └──────────────────────────────┘
                                                                  until risk is low
```

This workflow has **two enforced loops**:

- **plan → review → plan** (before any code): drives uncertainty down until the plan is `plan_approved`. Prevention layer.
- **code → code-review → code** (before each commit): drives risk down until the diff passes review. Detection layer — this is where over-engineering is actually caught, because only a real diff reveals unnecessary abstraction.

| Phase | Command | Description |
|-------|---------|-------------|
| 0. Prerequisite | `vibe skill` | Print this guide. Read it before every other command |
| 1. Initialize | `vibe start <JIRA_KEY>` | Create branch, fetch Jira issue, save context |
| 2. Context | `vibe context <JIRA_KEY>` | Resolve Figma/Confluence links, analyze repo and project conventions |
| 3. Plan | `vibe plan <JIRA_KEY>` | Generate step-by-step execution plan |
| 4. Plan Review | `vibe review <JIRA_KEY>` | Score plan uncertainty, surface open questions; loops back to plan until approved |
| 5. Code | `vibe code <JIRA_KEY> --step <N>` | Coding sub-agent implements the step and runs step verification |
| 6. Code Review | `vibe code-review <JIRA_KEY> --step <N>` | Review sub-agent scores diff risk (over-engineering, conventions, complexity); loops back to code until passed |
| 7. Commit | `vibe commit <JIRA_KEY> --step <N>` | Lead agent commits the step after the review sub-agent reports a pass |
| 8. Verify | `vibe verify <JIRA_KEY>` | Verify sub-agent runs task-level verification (lint, typecheck, test) |
| 9. PR | `vibe pr <JIRA_KEY>` | Lead agent generates a PR **draft** report only — never auto-pushes or opens a PR |

---

## Multi-Agent Roles

vibe work is done by one lead agent and several sub-agents. Every sub-agent runs `vibe skill` first.

### Lead agent

The agent that receives the user's first message is the lead for the whole task. It owns the conversation with the user and the task state:

- runs `vibe start`, `vibe commit`, `vibe fix`, `vibe pr`, `vibe resume`, `vibe scope`, and `vibe abort`
- decides when to dispatch sub-agents, picks each sub-agent's model and reasoning effort (at most High) by task complexity, and writes their prompts
- is the only agent that asks the user questions. Sub-agents return open questions to the lead instead of guessing
- reads each sub-agent's result and the reports under `reports/` before moving to the next phase
- does not write feature code and does not review its own diff

Dispatch one sub-agent at a time. Sub-agents share one worktree and one task state, so two of them must never run vibe commands or edit files at the same time.

### Preparation phase: lead decides

The lead may run `vibe context`, `vibe plan`, and `vibe review` itself, or dispatch a sub-agent for any of them. Dispatch a sub-agent when the work is large enough to crowd the lead's context, for example:

- many Figma frames, Confluence pages, or a reference repository to read for `vibe context`
- a plan spanning several modules or apps
- a review with many open questions that need code research before they reach the user

A preparation sub-agent returns a short summary, the report path, and any open questions. The plan → review → plan loop and its user questions still go through the lead.

### Coding phase: two sub-agents per step, required

For every step N the lead MUST dispatch two separate sub-agents, in order. Never use `vibe done` here, because it merges coding and review into one agent.

1. **Coding sub-agent**
   - reads `vibe show <JIRA_KEY>`, the step's `expectedFiles`, and `context.md`
   - makes the code changes for step N only
   - runs `vibe code <JIRA_KEY> --step N`. On `VERIFY_FAILED`, fixes the code and runs it again
   - does not run `vibe code-review` or `vibe commit`
   - returns the changed files and the verify result
2. **Review sub-agent** (a fresh agent, never the coding sub-agent)
   - runs `vibe code-review <JIRA_KEY> --step N` and reads the actual diff against project conventions
   - does not edit files
   - returns `passed`, `riskScore`, the CLI findings, its own must-fix items from reading the diff (empty list when there are none), and the report path

The step is committable only when both gates pass: `vibe code-review` reports `passed: true` **and** the review sub-agent's must-fix list is empty. A passing vibe score does not override a must-fix item; send it back to a coding sub-agent like a failed review.

If either gate fails, the lead dispatches a new coding sub-agent with the findings, then a new review sub-agent. Repeat until both pass. Then the lead runs `vibe commit <JIRA_KEY> --step N` and moves to step N+1.

Exception for size-only findings: when a review sub-agent has already returned an empty must-fix list for the current diff, and the only remaining CLI finding is the step-size rule (`maxInsertions`), the lead may rerun `vibe code-review <JIRA_KEY> --step N` itself for the following rounds instead of dispatching a new sub-agent each time. If the diff changes in any way, dispatch a review sub-agent again.

### Verification phase: verify sub-agent, required

After all steps are committed, the lead MUST dispatch a verify sub-agent:

- runs `vibe verify <JIRA_KEY>`
- does not edit files
- compares the commands that actually ran against the `scripts` in `package.json`. When the project has lint, typecheck, or test scripts that `verify.taskCommands` skipped, it lists them as missing, so the lead can add them to the config or run them separately
- returns each command with its exit code, the failing output, the missing scripts, and the path to `verify-report.md`

A verify run that skipped an existing `test` script does not count as a pass until the lead has run the tests.

If verification fails, the lead runs `vibe fix <JIRA_KEY> --message <text> --file <path>` to append a fix step, then runs that step through the coding phase: coding sub-agent, review sub-agent, lead commit. Then it dispatches a new verify sub-agent. Only after a verify sub-agent reports a pass does the lead run `vibe pr`.

### Sub-agent model selection

The lead picks a model and a reasoning effort for every sub-agent based on how complex that sub-agent's task is. Do not use one setting for everything.

| Complexity | Typical tasks | Model | Reasoning effort |
|------------|---------------|-------|------------------|
| Low | `vibe verify`; a step that touches 1–2 files with no new logic (copy, config, styles, types); `vibe context` with few links | Fast, low-cost model | Low |
| Medium | a normal feature step within one module; code review of a small diff; `vibe plan` for a single module | Default model | Medium |
| High | cross-module or cross-app plans; work that ports code from a reference repository; plan review with many open questions; steps with state, permissions, data flow, or concurrency; code review of a large diff | Strongest reasoning model | High |

Rules:

- Reasoning effort never goes above High. Do not use extra-high, max, or similar levels, even when escalating
- The review sub-agent's model and reasoning effort are never weaker than the coding sub-agent's for the same step
- If a step fails code review twice, or a sub-agent returns a wrong or incomplete result, dispatch the next sub-agent one tier higher. A High-tier sub-agent stays at High; split the step or ask the user instead
- A `vibe fix` step is rated by the failure it fixes, not by its size
- When the user names a model, use it

### Sub-agent prompt contract

Each sub-agent prompt from the lead includes:

- the Jira key, the step number (if any), and the role: context, plan, review, coding, code review, or verify
- the chosen model, its reasoning effort (at most High), and the complexity tier that justified it
- the exact vibe commands the sub-agent may run, and the commands it must not run
- the user's answers so far that affect this work
- the result format to return

---

## Agent Loop Model: plan → review → plan

This workflow enforces a deliberate loop to drive down uncertainty before any code is executed:

1. **Plan**: `vibe plan <JIRA_KEY>` generates a step-by-step plan (with assumptions and risks).
2. **Review**: `vibe review <JIRA_KEY>` evaluates the plan and produces:
   - an `uncertaintyScore` (0–1) compared against `review.uncertaintyThreshold` (default `0.2`)
   - a list of `openQuestions` covering divergence/scope/design/verification/context gaps
   - an `approved` verdict
3. **Decision**:
   - If **not approved** (score above threshold), the task returns to `planned`. You MUST:
     - Take the `openQuestions` and **ask the user** to resolve divergence and uncertainty (see next section).
     - Incorporate the answers into the plan file: record each answer in `decisions` (with the question text copied verbatim from `review.md`), update the steps, then rerun `vibe plan <JIRA_KEY> --from <file>`.
     - Run `vibe review` again. Repeat until approved (or until `review.maxIterations` is reached).
   - If **approved** (uncertainty low enough), the task moves to `plan_approved` and the lead may dispatch the first coding sub-agent.

**Hard rule:** `vibe code` will fail with `PLAN_NOT_APPROVED` if the plan has not been reviewed and approved. Never skip the review loop.

### Handling divergence & uncertainty — ask the user

Whenever the review surfaces open questions, or you otherwise encounter divergence (e.g. differences between target apps or environments, ambiguous acceptance criteria, missing Figma context, unclear file scope), you MUST pause and ask the user to clarify before continuing the loop. Do not guess or silently pick a direction on decisions that materially change the plan. Fold the user's answers back into the next `vibe plan` iteration.

---

## Agent Loop Model: code → code-review → code

This loop sits **between writing code and committing it**, and runs once per step:

1. **Code**: the coding sub-agent makes the changes for step N and runs `vibe code <JIRA_KEY> --step <N>`.
2. **Code Review**: `vibe code-review <JIRA_KEY> --step <N>` inspects the actual diff and produces:
   - a `riskScore` (0–1) compared against `codeReview.riskThreshold` (default `0.25`)
   - `findings` grouped by category: `over-engineering`, `convention`, `complexity`, `dependency`, `scope`
   - a `passed` verdict
3. **Decision**:
   - If **not passed**, the step stays un-committable. You MUST fix the findings (remove over-engineering first, then convention/complexity issues) and rerun `vibe code-review`. Repeat until passed (or until `codeReview.maxIterations` is reached).
   - If **passed**, the step becomes `reviewed` and can be committed.

**Hard rule:** `vibe commit` will fail with `CODE_REVIEW_NOT_PASSED` if the step has not passed code review. Never commit around the loop.

### Avoiding over-engineering (the primary purpose of this loop)

Apply YAGNI ruthlessly. Before accepting your own diff, check:

- **No speculative abstraction.** Do not add interfaces, factories, managers, wrappers, strategy/adapter layers, or "base" classes for a single concrete use case. Inline it until a second real caller exists.
- **No unused extension points.** No config flags, hooks, or generic parameters that nothing currently uses.
- **Minimal diff.** Prefer modifying existing files over creating new ones. Prefer deleting code over adding parallel code paths.
- **No new dependency** unless nothing existing can do the job; justify it explicitly if the diff touches `package.json`.
- **Scope discipline.** Only touch what the step's `expectedFiles` implies.

The reviewer flags insertions above `codeReview.maxInsertions`, files grown past `codeReview.maxFileLines`, abstraction-smell filenames, dependency manifest changes, and missing test coverage. Treat those findings as real signals, not noise to bypass.

**Single-file size rule.** A code file that this step creates or grows past `codeReview.maxFileLines` (default 300 lines) gets a split finding. Files that were already over the limit before the step are not flagged. The review sub-agent reads the file and decides:

- if it has a clear split boundary (a self-contained sub-component, hook, utility, type group, or constant table), splitting is a must-fix item
- if it has no clear boundary, the file stays as is, and the review sub-agent states why in its result

This finding alone does not fail `vibe code-review`; the must-fix gate enforces it.

The step line-count and single-file rules only count code. Tests (`*.test.*`, `*.spec.*`, `test/`, `tests/`, `__tests__/`) and docs (`*.md`, `*.mdx`, `*.mdc`, `doc/`, `docs/`, `spec/`, `specs/`) are left out of them, so a docs-only or test-heavy step is not flagged for size.

### Reviewing against project conventions and current best practices

Before you review (and before you fix findings), gather both kinds of standards:

1. **Project conventions (authoritative).** `vibe context` collects them into the `Conventions` section of `context.md`: `.cursor/rules` files, `AGENTS.md`, lint tools (eslint/prettier/biome), `tsconfig` strict mode, and available package scripts. Read the actual rule files when they exist — project rules always win over generic advice.
2. **Latest external standards (reference).** You MUST look up current documentation and patterns rather than relying on memory:
   - use **context7** to fetch the latest docs for the libraries/frameworks involved
   - use **WebSearch** for current design pattern / best practice guidance when the change involves a non-trivial design decision
   Then apply what you learned only where it does not conflict with project conventions, and only where it simplifies the code. Never introduce a pattern just because it is modern — that is itself over-engineering.

---

## Command Reference

### `vibe skill`

**Purpose:** Print this skill. This is the prerequisite for agents. Run it before `vibe start` or any later command, and follow the printed guide.

**Usage:**
```bash
vibe skill
```

---

### `vibe start <JIRA_KEY>`

**Purpose:** Initialize a new task from a Jira issue.

**What it does:**
1. Validates the Jira key against `jira.allowedPrefixes` in the workspace config (empty by default, which accepts any `<PREFIX>-<NUMBER>` key)
2. Ensures git worktree is clean
3. Fetches the Jira issue, its links (Figma, Confluence), and comments
4. When the issue reads like a cross-repo port, stops until `--confirm-target` is passed. Optional `--source <path>` records a read-only reference repository
5. Creates a feature branch from `branchPattern` (default: `feat/<JIRA_KEY>`)
6. Prints the write target, base branch, and feature branch, then saves issue data and links

**Usage:**
```bash
vibe start PROJ-123
```

**Prerequisites:**
- Git worktree must be clean (no uncommitted changes)
- Jira key must match `<PREFIX>-<NUMBER>`, and the prefix must be in `jira.allowedPrefixes` when that list is set
- Cross-repo issues require `vibe start <JIRA_KEY> --confirm-target`. Add `--source <path>` when another repository is only a reference

**After this:** Run `vibe context <JIRA_KEY>`

---

### `vibe context <JIRA_KEY>`

**Purpose:** Build rich context from Jira, Figma, Confluence, and the local repo.

**What it does:**
1. Resolves Confluence page content from linked URLs
2. Resolves Figma design context (node info, text, components, layout hints)
3. Fetches GitHub repository metadata
4. Analyzes the local repo structure (package manager, apps, routes, UI framework)
5. Generates a `context.md` report in the task's reports directory

**Usage:**
```bash
vibe context PROJ-123
```

**After this:** Run `vibe plan <JIRA_KEY>`

---

### `vibe plan <JIRA_KEY>`

**Purpose:** Generate a step-by-step execution plan.

**What it does:**
1. Uses AI to analyze the issue, context, and repo structure
2. Generates 3-7 steps, each with:
   - `id` (sequential number)
   - `title` and `description`
   - `expectedFiles` (files to be changed)
   - `verifyCommands` (per-step verification)
   - `commitMessage` (formatted as `feat(<JIRA_KEY>): <message>`)
3. Saves the plan as `plan.json` and renders `plan.md`

**Usage:**
```bash
vibe plan PROJ-123
vibe plan PROJ-123 --from plan-draft.json
```

Without `--from`, the generated steps are only a skeleton (generic titles, few or no `expectedFiles`). Use it to see the shape, then write the real plan in a JSON file and import it with `--from`. Do not edit `plan.json` in the state directory by hand.

`--from` file format. Only `steps[].title` is required:

```json
{
  "summary": "One-line goal of the task",
  "assumptions": ["Things the plan relies on that the user has not confirmed"],
  "risks": ["Known risks that still need an answer"],
  "decisions": [
    { "question": "Risk, assumption, or open-question text, copied verbatim", "answer": "What the user decided" }
  ],
  "steps": [
    {
      "title": "Add reporting API types",
      "description": "What this step changes and why",
      "expectedFiles": ["src/api/reporting.ts"],
      "verifyCommands": ["pnpm lint"],
      "commitMessage": "feat(PROJ-123): add reporting api types"
    }
  ]
}
```

- Imported steps are kept as written: no padding to `planning.minSteps`, no truncation of `expectedFiles`. Step ids are assigned in order from 1
- `verifyCommands` defaults to `verify.stepCommands`; `commitMessage` is re-rendered with `commitPattern`
- `decisions` records answers the user already gave. `vibe review` skips any risk, assumption, or open question whose text equals a decision's `question`, so answered questions stop counting toward uncertainty
- When a later `vibe plan` (with or without `--from`) has no `decisions`, the previous plan's decisions are kept
- An invalid file fails with `PLAN_INVALID` and lists the bad fields

Fails with `STEP_ALREADY_COMMITTED` once any step is committed, because a new plan would reset those steps. Add later work with `vibe fix`.

**After this:** Run `vibe review <JIRA_KEY>` to evaluate the plan before executing.

---

### `vibe review <JIRA_KEY>`

**Purpose:** Review the current plan, score its uncertainty, and decide whether it is ready to execute. This is the gate of the plan → review → plan loop.

**What it does:**
1. Evaluates the plan against heuristics and computes an `uncertaintyScore` (0–1)
2. Produces `openQuestions` grouped by category: `divergence`, `scope`, `design`, `verification`, `context`
3. Compares the score to `review.uncertaintyThreshold`:
   - `score <= threshold` → task becomes `plan_approved`; execution is unlocked
   - `score > threshold` → task returns to `planned`; you must resolve open questions and re-plan
4. Saves a `review.md` report and returns a recommended `nextAction`
5. If `review.maxIterations` is reached, the plan is force-approved to avoid infinite loops (a signal is recorded)

**Usage:**
```bash
vibe review PROJ-123
```

**Agent behavior when not approved:**
- Read the `openQuestions` in the returned result / `review.md`
- Skip questions the user already answered earlier in the conversation: add them to `decisions` instead of asking again
- **Ask the user** to resolve the remaining divergence and uncertainty
- Rerun `vibe plan <JIRA_KEY> --from <file>` with the answers in `decisions`, then `vibe review <JIRA_KEY>` again

**After this (when approved):** For each step, starting from step 1, the lead dispatches a coding sub-agent (`vibe code`) and then a review sub-agent (`vibe code-review`), then runs `vibe commit`.

---

### `vibe code <JIRA_KEY> --step <N>`

**Purpose:** Run by the coding sub-agent after it edits the code for step N. Records the step execution and runs the step verify commands.

**Usage:**
```bash
vibe code PROJ-123 --step 1
```

**Key behaviors:**
- Fails with `PLAN_NOT_APPROVED` before the plan is approved
- If a step verify command exits non-zero, stops with `VERIFY_FAILED`. Fix the code and run it again
- `--dry-run` skips verification

---

### `vibe code-review <JIRA_KEY> --step <N>`

**Purpose:** Review the current diff for a step, score its risk, and decide whether it may be committed. This is the gate of the code → code-review → code loop.

**What it does:**
1. Reads the current changed files and their diff stats (insertions/deletions, including untracked files)
2. Runs the scope check and heuristics over the diff, computing a `riskScore` (0–1)
3. Produces `findings` grouped by category: `over-engineering`, `convention`, `complexity`, `dependency`, `scope`
4. Compares the score to `codeReview.riskThreshold`:
   - `score <= threshold` → the step becomes `reviewed`; committing is unlocked
   - `score > threshold` → the step stays un-committable; fix the findings and re-review
5. Saves a `step-<N>-code-review.md` report and returns a recommended `nextAction`
6. If `codeReview.maxIterations` is reached, the review is force-passed to avoid infinite loops (a signal is recorded)

**Usage:**
```bash
vibe code-review PROJ-123 --step 1
```

**Agent behavior when not passed:**
- The review sub-agent returns the `findings` and the `step-<N>-code-review.md` path to the lead without editing files
- The lead dispatches a new coding sub-agent to fix them in priority order: over-engineering first, then convention, complexity, dependency, scope
- Consult project conventions (`.cursor/rules`, `AGENTS.md`, lint config) and look up current best practices with context7/WebSearch as needed
- The lead dispatches a new review sub-agent to rerun `vibe code-review <JIRA_KEY> --step <N>` until it passes

---

### `vibe commit <JIRA_KEY> --step <N>`

**Purpose:** Run by the lead after the review sub-agent reports a pass. Auto-stages the changed files, checks scope, and commits with the step's commit message.

**Usage:**
```bash
vibe commit PROJ-123 --step 1
```

**Key behaviors:**
- Fails with `CODE_REVIEW_NOT_PASSED` if the step has not passed code review
- Fails with `DIFF_OUT_OF_SCOPE` if files fall outside the step scope. Add them with `vibe scope` when they belong to the step
- Stages every changed file that git reports, including files under dot directories such as `.cursor/rules/`. Only the legacy `.vibe/` directory and gitignored files are skipped

**After every commit, the lead runs `git status --short` and expects empty output.** If files are still listed:

1. If they belong to work that is not committed yet, add them to the next pending step with `vibe scope <JIRA_KEY> --step <N+1> --file <path>` so they go in with that step's commit
2. If the step was the last one, add them with `vibe fix <JIRA_KEY> --message <text> --file <path>` and run the fix step through the coding phase
3. If they do not belong to the task, ask the user before discarding them

Never repair a commit with `git commit --amend`, never pass `--no-verify`, and never edit the SHAs in `progress.json` by hand. Each of these skips the git hooks or desynchronizes the vibe state from the branch.

---

### `vibe done <JIRA_KEY> --step <N>`

**Purpose:** Execute a plan step, code review it, and commit when the review passes. It chains `code` + `code-review` + `commit` into a single call. Agents following the multi-agent roles must not use it, because coding and code review run in separate sub-agents. Use it only when a human runs vibe-cli by hand.

**What it does:**
1. **Execute phase:** Reads the step's expectedFiles, generates an execution report with AI guidance, runs per-step verify commands
2. **Code review phase:** Scores the diff risk and prints the findings (see `vibe code-review`). If the review does not pass, the command stops here with `CODE_REVIEW_NOT_PASSED` and **nothing is committed**
3. **Commit phase** (only when the review passed):
   - Validates the commit message format
   - Auto-stages all changed files (no manual `git add` needed)
   - Validates changed files are within scope (directory-level check)
   - Commits with the step's commit message
   - Auto-updates the step's expectedFiles with actual committed files
   - Updates progress state

**Usage:**
```bash
# Execute, review, and commit step 1
vibe done PROJ-123 --step 1

# Execute, review, and commit step 2
vibe done PROJ-123 --step 2
```

**Options:**
| Option | Description |
|--------|-------------|
| `--step <N>` | Required. The step number to execute, review, and commit |
| `--dry-run` | Optional. Skip applying source changes during the execute phase |

**Key behaviors:**
- If a step verify command exits non-zero, `done` stops with `VERIFY_FAILED`. Nothing is reviewed or committed
- You do NOT need to run `git add` before this command — it auto-stages
- You do NOT need to run `vibe code` / `vibe code-review` / `vibe commit` separately — `done` chains all three
- If code review fails, fix the findings and rerun `vibe done` (or `vibe code-review` then `vibe commit`)
- Commit message must match: `^(feat|refactor|fix|style)(<JIRA_KEY>): .+$`
- Changed files are validated at the **directory level** — files in the same directory as expectedFiles are allowed (supports file-to-folder refactoring)
- If no diff is found, the command will fail with `DIFF_OUT_OF_SCOPE`

**After all steps are committed:** Run `vibe verify <JIRA_KEY>`

---

### `vibe verify <JIRA_KEY>`

**Purpose:** Run task-level verification commands across all changes.

**What it does:**
1. Runs `verify.taskCommands` from the workspace config. When the config file is first created, they are inferred from the repo's package scripts, in this order when present: `lint:ts`, `lint:js:check`, `lint:css:check`, `typecheck`, `specs:check`, `test`, `build`. A config created before `test` was inferred keeps its old list, so check it once per repo
2. If any command fails with exit code 127 (command not found), provides a hint to update the vibe config
3. If all pass, transitions task to `pr_ready` status

Fails with `STEPS_NOT_COMMITTED` while any plan step is uncommitted.
4. If any fail, transitions task to `failed` status

**Usage:**
```bash
vibe verify PROJ-123
```

**Note:** If verify commands don't match your project's actual scripts (for example `test` is missing), update `config.json` in the workspace state directory (see [State Management](#state-management)):
```json
{
  "verify": {
    "taskCommands": ["<pm> lint", "<pm> typecheck", "<pm> test"],
    "stepCommands": ["<pm> lint"]
  }
}
```

**After this:** Run `vibe pr <JIRA_KEY>` (or skip if PR creation is not needed)

---

### `vibe pr <JIRA_KEY>`

**Purpose:** Generate a PR **draft** report. This command NEVER pushes the branch or opens a PR.

**What it does:**
1. Gathers issue context, links, plan, and progress
2. Fetches GitHub PR context (existing related PRs, compare URL)
3. Generates a PR description with AI disclosure (reviewers are left to the repository's own rules, such as CODEOWNERS)
4. Saves the draft as `pr.md` in the task's reports directory

**Usage:**
```bash
vibe pr PROJ-123
```

Fails with `STEPS_NOT_COMMITTED` while any step is uncommitted, and with `TASK_NOT_VERIFIED` unless the task is `pr_ready`.

**Hard rule — do NOT auto-push or auto-create PRs:** After all steps are done and verified, generating the draft is the last automatic action. `git push` and PR creation are manual actions that require the user to review first. Do not run `git push`, `gh pr create`, or any push/PR command on your own. Present the `pr.md` draft to the user and wait for them to explicitly approve; only then perform push / PR creation.

---

### `vibe show <JIRA_KEY>`

**Purpose:** Display the current stored state for a task (issue, plan, progress).

**Usage:**
```bash
vibe show PROJ-123
```

---

### `vibe resume <JIRA_KEY>`

**Purpose:** Show the next recommended action for a task. Useful when you need to continue a previously started task.

**Usage:**
```bash
vibe resume PROJ-123
```

---

### `vibe scope <JIRA_KEY> --step <N> --file <path>`

**Purpose:** Add a relative path to a step's `expectedFiles` before commit. Use this when verification fixes land outside the original file list. Repeat `--file` for more than one path.

```bash
vibe scope PROJ-123 --step 5 --file src/routes.ts --file src/components/export-dialog.tsx
```

### `vibe fix <JIRA_KEY> --message <text> --file <path>`

**Purpose:** Run by the lead to append a fix step after every plan step is committed, for example when `vibe verify` fails or the user asks for changes after review. Repeat `--file` for each file the fix may touch.

```bash
vibe fix PROJ-123 --message "restore lint" --file src/components/list.tsx
```

**Key behaviors:**
- Fails while any plan step is still uncommitted. Fix the problem inside that step instead
- The new step uses the next step number and the commit message `fix(<JIRA_KEY>): <text>`
- The task returns to `plan_approved`. Run the new step through `vibe code`, `vibe code-review`, and `vibe commit`, then `vibe verify` again

---

### `vibe adopt <JIRA_KEY>`

**Purpose:** Rebuild task state from commits already on `feat/<JIRA_KEY>` when the local task directory is missing. Check out that branch first. Does not overwrite an active task; run `vibe resume` instead.

### `vibe abort <JIRA_KEY>`

**Purpose:** Abort a task. The task can be re-started with `vibe start`.

**Usage:**
```bash
vibe abort PROJ-123
```

---

### `vibe clean`

**Purpose:** Clear all local vibe state data.

**Usage:**
```bash
vibe clean
```

---

## Agent Workflow: Step-by-Step

Here is the complete workflow an AI agent should follow:

### Phase 1: Task Setup (lead)

```
0. vibe skill                     # Lead: prerequisite, read this guide before continuing
1. vibe start <JIRA_KEY>          # Lead: initialize task, create branch
2. vibe context <JIRA_KEY>        # Lead or context sub-agent
```

### Phase 2: Plan → Review → Plan loop (until uncertainty is low)

```
3. vibe plan <JIRA_KEY> [--from <file>]   # Lead or plan sub-agent
4. vibe review <JIRA_KEY>         # Lead or review sub-agent
   ├─ if NOT approved:
   │    → lead asks the user the open questions (resolve divergence/uncertainty)
   │    → go back to step 3 (vibe plan) with the answers folded in
   └─ if approved (score <= threshold): proceed to Phase 3
5. vibe show <JIRA_KEY>           # Lead: inspect the approved plan and step details
```

Do not leave this loop until `vibe review` reports `approved: true`. Executing steps before approval fails with `PLAN_NOT_APPROVED`.

### Phase 3: Implementation with code review loop (per step, two sub-agents)

For each step N in the plan (starting from 1):

```
6. Coding sub-agent:  vibe skill → edit code for step N → vibe code <JIRA_KEY> --step N
7. Review sub-agent:  vibe skill → vibe code-review <JIRA_KEY> --step N   # no file edits
   ├─ if NOT passed, or the review sub-agent returned must-fix items:
   │    → lead dispatches a new coding sub-agent with the findings (over-engineering first)
   │    → then a new review sub-agent; repeat until both gates pass
   └─ if passed and no must-fix items:
8. Lead:              vibe commit <JIRA_KEY> --step N
9. Lead:              git status --short   # must be empty; otherwise recover with vibe scope / vibe fix
```

**Important agent behaviors during implementation:**
- The coding sub-agent reads the plan's `expectedFiles` for the step to understand scope
- Before reviewing/fixing, consult project conventions and look up current best practices (context7/WebSearch) — see the code review loop section
- Do not leave the loop by committing around it; `vibe commit` enforces `CODE_REVIEW_NOT_PASSED`
- `vibe commit` auto-stages — do NOT run `git add` or `git commit` manually
- If you need to refactor a file into a directory (e.g., `details.tsx` → `details/index.tsx`), the directory-level scope check will allow it
- Commit messages in the plan are pre-formatted; if you change the plan, use prefixes: `feat`, `refactor`, `fix`, or `style`

### Phase 4: Verification & PR draft (stop before push)

```
10. Verify sub-agent: vibe skill → vibe verify <JIRA_KEY>   # no file edits; report skipped package scripts
    └─ if failed: lead vibe fix → coding sub-agent → review sub-agent → lead commit → new verify sub-agent
11. Lead:             vibe pr <JIRA_KEY>                    # Generate PR DRAFT only
```

**After the PR draft is generated, STOP.** Do not push the branch or create the PR. Present the draft to the user and wait for their explicit review/approval before performing any `git push` / PR creation.

---

## State Management

Vibe-cli keeps all state outside the repository, in a per-workspace state directory:

| Platform | Workspace state directory |
|----------|---------------------------|
| macOS | `~/Library/Application Support/vibe-cli/workspaces/<repo>-<hash>/` |
| Linux | `${XDG_STATE_HOME:-~/.local/state}/vibe-cli/workspaces/<repo>-<hash>/` |
| Windows | `%APPDATA%\vibe-cli\workspaces\<repo>-<hash>\` |

- `<repo>` is the lowercased repository folder name; `<hash>` is the first 12 hex characters of the SHA-1 of the repository's absolute path
- Setting `VIBE_STATE_ROOT` replaces `.../vibe-cli` with that directory
- The fastest way to find it: every `vibe context`, `vibe plan`, `vibe review`, and `vibe code-review` result prints a `reportPath` inside `<state dir>/tasks/<JIRA_KEY>/`
- The repository's `.vibe/` directory is legacy and no longer used

The workspace config is `<state dir>/config.json`. Each task lives in `<state dir>/tasks/<JIRA_KEY>/`:

| File | Content |
|------|---------|
| `issue.json` | Jira issue data |
| `links.json` | External links (Figma, Confluence) |
| `repo-context.json` | Local repo analysis |
| `plan.json` | Execution plan with step statuses |
| `progress.json` | Task progress, commits, current step, plan/code review iterations & last scores |
| `reports/` | Generated reports (context.md, plan.md, review.md, step-N-code-review.md, verify-report.md, pr.md) |
| `logs/` | Operation logs |

### Step Status Lifecycle

```
pending → coded → reviewed → committed
                ↑________|
        (code review not passed: fix and re-review)
```

- `pending`: Step not yet started
- `coded`: Step executed (report generated) but not yet code reviewed
- `verified`: Step executed and step verification passed
- `reviewed`: Step passed code review; committing is unlocked
- `committed`: Changes committed to git
- `failed`: Step failed (can be retried)

### Task Status Lifecycle

```
initialized → context_ready → planned ⇄ reviewing → plan_approved → coding ⇄ code_review → verifying → pr_ready
                                  ↑__________________|
                          (loop back when uncertainty is too high)
```

- `planned`: A plan exists but has not been approved by review
- `reviewing`: Plan is being reviewed; transitions to `plan_approved` (low uncertainty) or back to `planned` (needs refinement)
- `plan_approved`: Uncertainty is low enough; execution (`vibe code`) is unlocked. `vibe fix` also returns a `failed`, `verifying`, or `pr_ready` task here
- `coding`: A step is being implemented, or a step passed code review and is ready to commit
- `code_review`: A step's diff is awaiting/undergoing code review; committing is blocked until it passes

---

## Configuration

Vibe-cli config is stored in `<state dir>/config.json` (see [State Management](#state-management)). It is created on first run. Key settings:

```json
{
  "branchPattern": "feat/{jiraKey}",
  "commitPattern": "feat({jiraKey}): {message}",
  "baseBranch": "main",
  "jira": {
    "provider": "auto",
    "allowedPrefixes": ["PROJ"]
  },
  "figma": {
    "provider": "figma-mcp"
  },
  "github": {
    "provider": "github-mcp",
    "repository": "owner/repo"
  },
  "planning": {
    "minSteps": 3,
    "maxSteps": 7,
    "maxFilesPerStep": 12
  },
  "verify": {
    "stepCommands": ["<pm> lint"],
    "taskCommands": ["<pm> lint", "<pm> typecheck", "<pm> test"]
  },
  "review": {
    "uncertaintyThreshold": 0.2,
    "maxIterations": 3
  },
  "codeReview": {
    "riskThreshold": 0.25,
    "maxIterations": 3,
    "maxInsertions": 1000,
    "maxFileLines": 300
  }
}
```

**Plan review settings (`review`):**
- `uncertaintyThreshold`: The plan is approved when `uncertaintyScore <= threshold`. Lower it to demand a more certain plan (more loop iterations); raise it to be more permissive.
- `maxIterations`: Safety cap on the plan → review loop. When reached, the plan is force-approved so the workflow cannot loop forever.

**Code review settings (`codeReview`):**
- `riskThreshold`: The diff passes when `riskScore <= threshold`. Lower it to be stricter about over-engineering.
- `maxIterations`: Safety cap on the code → code-review loop. When reached, the review is force-passed.
- `maxInsertions`: Total inserted code lines above this is flagged as too large a step.
- `maxFileLines`: A code file that this step creates or grows past this many lines must be split when it has a clear split boundary (see the single-file size rule above).
- Tests and docs are not counted by `maxInsertions` or `maxFileLines`. The number of new files in a step is not limited.

---

## Error Handling

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `INVALID_JIRA_KEY` | Jira key doesn't match `jira.allowedPrefixes` | Use `<PREFIX>-<NUMBER>` from config, or add the prefix there |
| `TARGET_NOT_CONFIRMED` | Cross-repo issue started without confirming the write repo | Re-run `vibe start <KEY> --confirm-target` and pass `--source` for the reference repo |
| `GIT_DIRTY_WORKTREE` | Uncommitted changes exist | Commit or stash changes first |
| `BRANCH_ALREADY_EXISTS` | Feature branch already exists | Use `vibe resume` or delete the branch |
| `PLAN_NOT_FOUND` | No plan exists for the task | Run `vibe plan` first |
| `PLAN_INVALID` | The `vibe plan --from` file does not match the plan format | Fix the fields listed in the error and rerun |
| `STEP_NOT_FOUND` | Step number not in plan | Check plan with `vibe show` |
| `STEP_ALREADY_COMMITTED` | Step was already committed, or `vibe plan` ran after a commit | Move to the next step; add later work with `vibe fix` |
| `STEPS_NOT_COMMITTED` | `vibe verify` or `vibe pr` ran with uncommitted steps | Finish each open step through code, code-review, commit |
| `TASK_NOT_VERIFIED` | `vibe pr` ran before the task reached `pr_ready` | Run `vibe verify` until it passes |
| `DIFF_OUT_OF_SCOPE` | Changed files outside step scope | Ensure changes match expectedFiles directory |
| `PLAN_NOT_APPROVED` | Tried to execute before the plan was approved | Run `vibe review`, resolve open questions, re-plan until approved |
| `CODE_REVIEW_NOT_PASSED` | Tried to commit before the diff passed code review | Fix the findings in `step-<N>-code-review.md` (over-engineering first), then rerun `vibe code-review` |
| `VERIFY_FAILED` | Verification commands failed | During a step, fix the code and rerun `vibe code`. After all steps are committed, add a fix step with `vibe fix` |
| `STATE_CORRUPTED` | Internal state inconsistency | Check logs, may need `vibe clean` + restart |
| `JIRA_FETCH_FAILED` | Cannot fetch Jira issue | Check Jira connectivity and permissions |

---

## Best Practices for Agents

Run `vibe skill` before anything else. The printed guide is the prerequisite for the rules below.

1. **Never skip the plan → review loop** — run `vibe review` after `vibe plan`, and keep looping (plan → review → plan) until it reports `approved: true`. Execution is blocked before approval.
2. **Ask the user on divergence/uncertainty** — when review surfaces open questions (or you hit any ambiguous/divergent decision), pause and ask the user; fold answers into the next `vibe plan`. Don't guess on decisions that change the plan.
3. **Never skip the code → code-review loop** — every step must pass `vibe code-review` before it can be committed. Keep fixing and re-reviewing until it passes.
4. **Default to less code** — YAGNI. No speculative abstraction, no unused extension points, no new dependency without justification. Over-engineering is the failure mode this loop exists to catch.
5. **Review against project conventions first, external patterns second** — read `.cursor/rules`/`AGENTS.md`/lint config; use context7 for latest library docs and WebSearch for current design patterns, but never let a "modern pattern" add complexity the task doesn't need.
6. **Never auto-push or auto-create PRs** — `vibe pr` produces a draft only. Stop there and let the user review; `git push` and PR creation are manual, user-triggered actions.
7. **Split coding and review across sub-agents** — the lead dispatches a coding sub-agent (`vibe code`) and a separate review sub-agent (`vibe code-review`) for every step, commits with `vibe commit`, and dispatches a verify sub-agent for `vibe verify`. Do not use `vibe done`
8. **Read the plan before implementing** — use `vibe show` to understand expectedFiles and commit messages
9. **One step at a time** — implement, review, commit, then move to the next step
10. **Don't manually `git add` or `git commit`** — vibe-cli handles this. Check `git status --short` is empty after each `vibe commit`, and recover leftover files with `vibe scope` or `vibe fix`, never with `--amend` or `--no-verify`
11. **Respect step scope** — changes should be in or near the expectedFiles directory
12. **Use `--dry-run` for preview** — if unsure, run with `--dry-run` first to see what would happen
13. **Check `vibe resume` if interrupted** — it tells you the next recommended action
14. **Update verify commands if needed** — if `vibe verify` fails with command not found, or skips an existing `test` script, update `<state dir>/config.json`

---

## Example: Complete Task Flow

```bash
# 0. Prerequisite
vibe skill

# 1. Start task
vibe start PROJ-123

# 2. Build context
vibe context PROJ-123

# 3. Generate the skeleton, write the real plan to a JSON file, then import it
vibe plan PROJ-123
vibe plan PROJ-123 --from plan-draft.json

# 4. Review plan (plan → review → plan loop)
vibe review PROJ-123
#    If NOT approved: ask the user the open questions, then:
#      vibe plan PROJ-123 --from plan-draft.json   # answers recorded in "decisions"
#      vibe review PROJ-123   # re-review; repeat until approved

# 5. Inspect the approved plan
vibe show PROJ-123

# 6. Step 1 (e.g., add API types)
#    Coding sub-agent: [make code changes in the codebase]
vibe code PROJ-123 --step 1
#    Review sub-agent (fresh agent, no file edits):
vibe code-review PROJ-123 --step 1
#    If NOT passed: lead dispatches a new coding sub-agent with the findings,
#    then a new review sub-agent; repeat until passed
#    Lead:
vibe commit PROJ-123 --step 1

# 7. Steps 2..N repeat the same coding sub-agent → review sub-agent → lead commit cycle

# 8. Verify sub-agent: verify all changes
vibe verify PROJ-123
#    If it fails, lead appends a fix step and runs it through the coding phase:
#      vibe fix PROJ-123 --message "restore lint" --file src/components/list.tsx
#      coding sub-agent → review sub-agent → lead: vibe commit PROJ-123 --step 4
#      new verify sub-agent: vibe verify PROJ-123

# 9. Lead: generate PR DRAFT only — then STOP and wait for user review.
#     Do NOT push or open a PR automatically.
vibe pr PROJ-123