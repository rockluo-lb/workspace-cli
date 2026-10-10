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
| 5. Execute | `vibe done <JIRA_KEY> --step <N>` | Execute a step, code review it, and commit only when the review passes |
| 6. Code Review | `vibe code-review <JIRA_KEY> --step <N>` | Score diff risk (over-engineering, conventions, complexity); loops back to code until passed |
| 7. Verify | `vibe verify <JIRA_KEY>` | Run task-level verification (lint, typecheck, test) |
| 8. PR | `vibe pr <JIRA_KEY>` | Generate a PR **draft** report only — never auto-pushes or opens a PR |

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
     - Incorporate the answers, then rerun `vibe plan` to refine the plan.
     - Run `vibe review` again. Repeat until approved (or until `review.maxIterations` is reached).
   - If **approved** (uncertainty low enough), the task moves to `plan_approved` and you may begin executing steps with `vibe done`.

**Hard rule:** `vibe done` will fail with `PLAN_NOT_APPROVED` if the plan has not been reviewed and approved. Never skip the review loop.

### Handling divergence & uncertainty — ask the user

Whenever the review surfaces open questions, or you otherwise encounter divergence (e.g. multi-portal differences, ambiguous acceptance criteria, missing Figma context, unclear file scope), you MUST pause and ask the user to clarify before continuing the loop. Do not guess or silently pick a direction on decisions that materially change the plan. Fold the user's answers back into the next `vibe plan` iteration.

---

## Agent Loop Model: code → code-review → code

This loop sits **between writing code and committing it**, and runs once per step:

1. **Code**: make the changes for step N (`vibe done` runs the step execution report first).
2. **Code Review**: `vibe code-review <JIRA_KEY> --step <N>` inspects the actual diff and produces:
   - a `riskScore` (0–1) compared against `codeReview.riskThreshold` (default `0.25`)
   - `findings` grouped by category: `over-engineering`, `convention`, `complexity`, `dependency`, `scope`
   - a `passed` verdict
3. **Decision**:
   - If **not passed**, the step stays un-committable. You MUST fix the findings (remove over-engineering first, then convention/complexity issues) and rerun `vibe code-review`. Repeat until passed (or until `codeReview.maxIterations` is reached).
   - If **passed**, the step becomes `reviewed` and can be committed.

**Hard rule:** `vibe commit` / `vibe done` will fail with `CODE_REVIEW_NOT_PASSED` if the step has not passed code review. Never commit around the loop.

### Avoiding over-engineering (the primary purpose of this loop)

Apply YAGNI ruthlessly. Before accepting your own diff, check:

- **No speculative abstraction.** Do not add interfaces, factories, managers, wrappers, strategy/adapter layers, or "base" classes for a single concrete use case. Inline it until a second real caller exists.
- **No unused extension points.** No config flags, hooks, or generic parameters that nothing currently uses.
- **Minimal diff.** Prefer modifying existing files over creating new ones. Prefer deleting code over adding parallel code paths.
- **No new dependency** unless nothing existing can do the job; justify it explicitly if the diff touches `package.json`.
- **Scope discipline.** Only touch what the step's `expectedFiles` implies.

The reviewer flags pure-addition file counts above `codeReview.maxNewFiles`, insertions above `codeReview.maxInsertions`, abstraction-smell filenames, dependency manifest changes, and missing test coverage. Treat those findings as real signals, not noise to bypass.

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
1. Validates the Jira key against `jira.allowedPrefixes` in the workspace config (default prefix: `CRMCN`)
2. Ensures git worktree is clean
3. Fetches the Jira issue, its links (Figma, Confluence), and comments
4. For a cross-repo migration, stops until `--confirm-target` is passed. Optional `--source <path>` records the read-only legacy repo
5. Creates a feature branch from `branchPattern` (default: `feat/<JIRA_KEY>`)
6. Prints the write target, base branch, and feature branch, then saves issue data and links

**Usage:**
```bash
vibe start CRMCN-11400
```

**Prerequisites:**
- Git worktree must be clean (no uncommitted changes)
- Jira key must match `<PREFIX>-<NUMBER>` for a prefix in `jira.allowedPrefixes`
- Migration issues require `vibe start <JIRA_KEY> --confirm-target`. Add `--source <legacy-repo>` when the old repo is only a reference

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
vibe context CRMCN-11400
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
vibe plan CRMCN-11400
```

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
vibe review CRMCN-11400
```

**Agent behavior when not approved:**
- Read the `openQuestions` in the returned result / `review.md`
- **Ask the user** to resolve the divergence and uncertainty
- Rerun `vibe plan <JIRA_KEY>` incorporating the answers, then `vibe review <JIRA_KEY>` again

**After this (when approved):** Run `vibe done <JIRA_KEY> --step <N>` for each step, starting from step 1.

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
vibe code-review CRMCN-11400 --step 1
```

**Agent behavior when not passed:**
- Read the `findings` in the returned result / `step-<N>-code-review.md`
- Fix them in priority order: over-engineering first, then convention, complexity, dependency, scope
- Consult project conventions (`.cursor/rules`, `AGENTS.md`, lint config) and look up current best practices with context7/WebSearch as needed
- Rerun `vibe code-review <JIRA_KEY> --step <N>` until it passes

---

### `vibe done <JIRA_KEY> --step <N>`

**Purpose:** Execute a plan step, code review it, and commit when the review passes. This is the **recommended** command for agents — it chains `code` + `code-review` + `commit` into a single call.

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
vibe done CRMCN-11400 --step 1

# Execute, review, and commit step 2
vibe done CRMCN-11400 --step 2
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
1. Runs the configured verification commands (default: `pnpm lint`, `pnpm typecheck`, `pnpm test --changed`)
2. If any command fails with exit code 127 (command not found), provides a hint to update the vibe config
3. If all pass, transitions task to `pr_ready` status
4. If any fail, transitions task to `failed` status

**Usage:**
```bash
vibe verify CRMCN-11400
```

**Note:** If verify commands don't match your project's actual scripts, update the vibe config file at `.vibe/config.json`:
```json
{
  "verify": {
    "taskCommands": ["pnpm lint:ts", "pnpm lint:js"],
    "stepCommands": ["pnpm lint:ts"]
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
3. Generates a PR description with AI disclosure, reviewer assignments
4. Saves the draft as `pr.md` in the task's reports directory

**Usage:**
```bash
vibe pr CRMCN-11400
```

**Hard rule — do NOT auto-push or auto-create PRs:** After all steps are done and verified, generating the draft is the last automatic action. `git push` and PR creation are manual actions that require the user to review first. Do not run `git push`, `gh pr create`, or any push/PR command on your own. Present the `pr.md` draft to the user and wait for them to explicitly approve; only then perform push / PR creation.

---

### `vibe show <JIRA_KEY>`

**Purpose:** Display the current stored state for a task (issue, plan, progress).

**Usage:**
```bash
vibe show CRMCN-11400
```

---

### `vibe resume <JIRA_KEY>`

**Purpose:** Show the next recommended action for a task. Useful when you need to continue a previously started task.

**Usage:**
```bash
vibe resume CRMCN-11400
```

---

### `vibe scope <JIRA_KEY> --step <N> --file <path>`

**Purpose:** Add a relative path to a step's `expectedFiles` before commit. Use this when verification fixes land outside the original file list. Repeat `--file` for more than one path.

```bash
vibe scope PJ-914 --step 5 --file src/router/routes.tsx --file src/view/export-dialog.tsx
```

### `vibe adopt <JIRA_KEY>`

**Purpose:** Rebuild task state from commits already on `feat/<JIRA_KEY>` when the local task directory is missing. Check out that branch first. Does not overwrite an active task; run `vibe resume` instead.

### `vibe abort <JIRA_KEY>`

**Purpose:** Abort a task. The task can be re-started with `vibe start`.

**Usage:**
```bash
vibe abort CRMCN-11400
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

### Phase 1: Task Setup

```
0. vibe skill                     # Prerequisite: read this guide before continuing
1. vibe start <JIRA_KEY>          # Initialize task, create branch
2. vibe context <JIRA_KEY>        # Build context from Jira/Figma/Confluence/repo
```

### Phase 2: Plan → Review → Plan loop (until uncertainty is low)

```
3. vibe plan <JIRA_KEY>           # Generate / refine execution plan
4. vibe review <JIRA_KEY>         # Score uncertainty, surface open questions
   ├─ if NOT approved:
   │    → ask the user the open questions (resolve divergence/uncertainty)
   │    → go back to step 3 (vibe plan) with the answers folded in
   └─ if approved (score <= threshold): proceed to Phase 3
5. vibe show <JIRA_KEY>           # Inspect the approved plan and step details
```

Do not leave this loop until `vibe review` reports `approved: true`. Executing steps before approval fails with `PLAN_NOT_APPROVED`.

### Phase 3: Implementation with code review loop (per step)

For each step N in the plan (starting from 1):

```
6. [Make the code changes for step N in the codebase]
7. vibe done <JIRA_KEY> --step N  # Execute report + code review + (if passed) auto-stage + commit
   └─ if code review NOT passed (CODE_REVIEW_NOT_PASSED):
        → fix the findings (remove over-engineering first)
        → vibe code-review <JIRA_KEY> --step N   # re-review
        → repeat until passed, then: vibe commit <JIRA_KEY> --step N
```

**Important agent behaviors during implementation:**
- Read the plan's `expectedFiles` for each step to understand scope
- Before reviewing/fixing, consult project conventions and look up current best practices (context7/WebSearch) — see the code review loop section
- Do not leave the loop by committing around it; `vibe commit` enforces `CODE_REVIEW_NOT_PASSED`
- The `done` command will auto-stage and commit — do NOT run `git add` or `git commit` manually
- If you need to refactor a file into a directory (e.g., `details.tsx` → `details/index.tsx`), the directory-level scope check will allow it
- Commit messages in the plan are pre-formatted; if you change the plan, use prefixes: `feat`, `refactor`, `fix`, or `style`

### Phase 4: Verification & PR draft (stop before push)

```
8. vibe verify <JIRA_KEY>         # Run lint/typecheck/test
9. vibe pr <JIRA_KEY>             # Generate PR DRAFT only
```

**After the PR draft is generated, STOP.** Do not push the branch or create the PR. Present the draft to the user and wait for their explicit review/approval before performing any `git push` / PR creation.

---

## State Management

Vibe-cli maintains state in `.vibe/tasks/<JIRA_KEY>/`:

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
- `plan_approved`: Uncertainty is low enough; execution (`vibe done`) is unlocked
- `coding`: A step is being implemented, or a step passed code review and is ready to commit
- `code_review`: A step's diff is awaiting/undergoing code review; committing is blocked until it passes

---

## Configuration

Vibe-cli config is stored in `.vibe/config.json`. Key settings:

```json
{
  "branchPattern": "feat/{jiraKey}",
  "commitPattern": "feat({jiraKey}): {message}",
  "baseBranch": "main",
  "jira": {
    "provider": "auto",
    "allowedPrefixes": ["CRMCN"]
  },
  "figma": {
    "provider": "figma-mcp"
  },
  "github": {
    "provider": "github-mcp",
    "repository": "owner/repo",
    "reviewers": ["reviewer1", "reviewer2"]
  },
  "planning": {
    "minSteps": 3,
    "maxSteps": 7,
    "maxFilesPerStep": 12
  },
  "verify": {
    "stepCommands": ["pnpm lint"],
    "taskCommands": ["pnpm lint", "pnpm typecheck", "pnpm test --changed"]
  },
  "review": {
    "uncertaintyThreshold": 0.2,
    "maxIterations": 3
  },
  "codeReview": {
    "riskThreshold": 0.25,
    "maxIterations": 3,
    "maxNewFiles": 3,
    "maxInsertions": 400
  }
}
```

**Plan review settings (`review`):**
- `uncertaintyThreshold`: The plan is approved when `uncertaintyScore <= threshold`. Lower it to demand a more certain plan (more loop iterations); raise it to be more permissive.
- `maxIterations`: Safety cap on the plan → review loop. When reached, the plan is force-approved so the workflow cannot loop forever.

**Code review settings (`codeReview`):**
- `riskThreshold`: The diff passes when `riskScore <= threshold`. Lower it to be stricter about over-engineering.
- `maxIterations`: Safety cap on the code → code-review loop. When reached, the review is force-passed.
- `maxNewFiles`: Pure-addition file count above this is flagged as possible over-engineering.
- `maxInsertions`: Total inserted lines above this is flagged as too large a step; a single file above half this value is flagged for doing too much.

---

## Error Handling

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `INVALID_JIRA_KEY` | Jira key doesn't match `jira.allowedPrefixes` | Use `<PREFIX>-<NUMBER>` from config, or add the prefix there |
| `TARGET_NOT_CONFIRMED` | Migration issue started without confirming the write repo | Re-run `vibe start <KEY> --confirm-target` and pass `--source` for the legacy repo |
| `GIT_DIRTY_WORKTREE` | Uncommitted changes exist | Commit or stash changes first |
| `BRANCH_ALREADY_EXISTS` | Feature branch already exists | Use `vibe resume` or delete the branch |
| `PLAN_NOT_FOUND` | No plan exists for the task | Run `vibe plan` first |
| `STEP_NOT_FOUND` | Step number not in plan | Check plan with `vibe show` |
| `STEP_ALREADY_COMMITTED` | Step was already committed | Move to the next step |
| `DIFF_OUT_OF_SCOPE` | Changed files outside step scope | Ensure changes match expectedFiles directory |
| `PLAN_NOT_APPROVED` | Tried to execute before the plan was approved | Run `vibe review`, resolve open questions, re-plan until approved |
| `CODE_REVIEW_NOT_PASSED` | Tried to commit before the diff passed code review | Fix the findings in `step-<N>-code-review.md` (over-engineering first), then rerun `vibe code-review` |
| `VERIFY_FAILED` | Verification commands failed | Fix issues and retry |
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
7. **Always use `vibe done` instead of `vibe code` + `vibe code-review` + `vibe commit`** — it chains all three and handles staging automatically
8. **Read the plan before implementing** — use `vibe show` to understand expectedFiles and commit messages
9. **One step at a time** — implement, review, commit, then move to the next step
10. **Don't manually `git add` or `git commit`** — vibe-cli handles this
11. **Respect step scope** — changes should be in or near the expectedFiles directory
12. **Use `--dry-run` for preview** — if unsure, run with `--dry-run` first to see what would happen
13. **Check `vibe resume` if interrupted** — it tells you the next recommended action
14. **Update verify commands if needed** — if `vibe verify` fails with command not found, update `.vibe/config.json`

---

## Example: Complete Task Flow

```bash
# 0. Prerequisite
vibe skill

# 1. Start task
vibe start CRMCN-11400

# 2. Build context
vibe context CRMCN-11400

# 3. Generate plan
vibe plan CRMCN-11400

# 4. Review plan (plan → review → plan loop)
vibe review CRMCN-11400
#    If NOT approved: ask the user the open questions, then:
#      vibe plan CRMCN-11400     # refine with the answers
#      vibe review CRMCN-11400   # re-review; repeat until approved

# 5. Inspect the approved plan
vibe show CRMCN-11400

# 6. Implement step 1 (e.g., add API types and i18n keys)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 1
#    If code review NOT passed (code → code-review → code loop):
#      [fix the findings, removing over-engineering first]
#      vibe code-review CRMCN-11400 --step 1   # re-review; repeat until passed
#      vibe commit CRMCN-11400 --step 1

# 7. Implement step 2 (e.g., build table component with filters)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 2

# 8. Implement step 3 (e.g., refactor into folder structure)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 3

# 9. Verify all changes
vibe verify CRMCN-11400

# 10. Generate PR DRAFT only — then STOP and wait for user review.
#     Do NOT push or open a PR automatically.
vibe pr CRMCN-11400