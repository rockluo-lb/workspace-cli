# Vibe-CLI Skill Guide for AI Agents

## Overview

`vibe-cli` is a Jira-driven step-based vibe coding workflow CLI. It orchestrates the full lifecycle of a development task: from Jira issue analysis, through planning and execution, to PR generation. As an AI agent, you use vibe-cli to manage structured, auditable, and incremental code changes tied to Jira tickets.

**Binary:** `vibe` (run from the project root directory)

---

## Workflow Lifecycle

```
start → context → ┌─────────────────────────────┐ → [done --step N per step] → verify → pr (draft only)
                  │  plan → review → plan (loop) │
                  └─────────────────────────────┘
                     until uncertainty is low
```

The core of this workflow is the **plan → review → plan loop**: you keep refining the plan and re-reviewing it until the uncertainty score drops below the configured threshold (the plan becomes `plan_approved`). Only then may you execute steps. See "Agent Loop Model" below.

| Phase | Command | Description |
|-------|---------|-------------|
| 1. Initialize | `vibe start <JIRA_KEY>` | Create branch, fetch Jira issue, save context |
| 2. Context | `vibe context <JIRA_KEY>` | Resolve Figma/Confluence links, analyze repo |
| 3. Plan | `vibe plan <JIRA_KEY>` | Generate step-by-step execution plan |
| 4. Review | `vibe review <JIRA_KEY>` | Score plan uncertainty, surface open questions; loops back to plan until approved |
| 5. Execute | `vibe done <JIRA_KEY> --step <N>` | Execute a step and commit in one atomic operation (only after plan is approved) |
| 6. Verify | `vibe verify <JIRA_KEY>` | Run task-level verification (lint, typecheck, test) |
| 7. PR | `vibe pr <JIRA_KEY>` | Generate a PR **draft** report only — never auto-pushes or opens a PR |

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

## Command Reference

### `vibe start <JIRA_KEY>`

**Purpose:** Initialize a new task from a Jira issue.

**What it does:**
1. Validates the Jira key format (e.g., `CRMCN-11400`)
2. Ensures git worktree is clean
3. Fetches the Jira issue, its links (Figma, Confluence), and comments
4. Creates a feature branch (pattern: `feat/<JIRA_KEY>`)
5. Saves issue data and links to local state

**Usage:**
```bash
vibe start CRMCN-11400
```

**Prerequisites:**
- Git worktree must be clean (no uncommitted changes)
- Jira key must match pattern: `<PREFIX>-<NUMBER>` (default prefix: `CRMCN`)

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

### `vibe done <JIRA_KEY> --step <N>`

**Purpose:** Execute a plan step AND commit the changes in one atomic operation. This is the **recommended** command for agents — it combines `code` + `commit` into a single call.

**What it does:**
1. **Execute phase:** Reads the step's expectedFiles, generates an execution report with AI guidance, runs per-step verify commands
2. **Commit phase:**
   - Validates the commit message format
   - Auto-stages all changed files (no manual `git add` needed)
   - Validates changed files are within scope (directory-level check)
   - Commits with the step's commit message
   - Auto-updates the step's expectedFiles with actual committed files
   - Updates progress state

**Usage:**
```bash
# Execute and commit step 1
vibe done CRMCN-11400 --step 1

# Execute and commit step 2
vibe done CRMCN-11400 --step 2

# Dry-run (execute only, no commit)
vibe done CRMCN-11400 --step 1 --dry-run
```

**Options:**
| Option | Description |
|--------|-------------|
| `--step <N>` | Required. The step number to execute and commit |
| `--dry-run` | Optional. Execute without committing (report only) |

**Key behaviors:**
- You do NOT need to run `git add` before this command — it auto-stages
- You do NOT need to run `vibe code` separately — `done` handles both code and commit
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

### Phase 3: Implementation (per step)

For each step N in the plan (starting from 1):

```
6. [Make the code changes for step N in the codebase]
7. vibe done <JIRA_KEY> --step N  # Execute report + auto-stage + commit
```

**Important agent behaviors during implementation:**
- Read the plan's `expectedFiles` for each step to understand scope
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
| `progress.json` | Task progress, commits, current step, review iteration & last uncertainty score |
| `reports/` | Generated reports (context.md, plan.md, review.md, verify-report.md, pr.md) |
| `logs/` | Operation logs |

### Step Status Lifecycle

```
pending → coded → verified → committed
                ↗
pending → committed (direct commit via `done`)
```

- `pending`: Step not yet started
- `coded`: Step executed (report generated) but not committed
- `verified`: Step executed and verification passed
- `committed`: Changes committed to git
- `failed`: Step failed (can be retried)

### Task Status Lifecycle

```
initialized → context_ready → planned ⇄ reviewing → plan_approved → coding → verifying → pr_ready
                                  ↑__________________|
                          (loop back when uncertainty is too high)
```

- `planned`: A plan exists but has not been approved by review
- `reviewing`: Plan is being reviewed; transitions to `plan_approved` (low uncertainty) or back to `planned` (needs refinement)
- `plan_approved`: Uncertainty is low enough; execution (`vibe done`) is unlocked

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
  }
}
```

**Review settings:**
- `uncertaintyThreshold`: The plan is approved when `uncertaintyScore <= threshold`. Lower it to demand a more certain plan (more loop iterations); raise it to be more permissive.
- `maxIterations`: Safety cap on the plan → review loop. When reached, the plan is force-approved so the workflow cannot loop forever.

---

## Error Handling

| Error Code | Meaning | Resolution |
|------------|---------|------------|
| `INVALID_JIRA_KEY` | Jira key doesn't match pattern | Use format `CRMCN-1234` |
| `GIT_DIRTY_WORKTREE` | Uncommitted changes exist | Commit or stash changes first |
| `BRANCH_ALREADY_EXISTS` | Feature branch already exists | Use `vibe resume` or delete the branch |
| `PLAN_NOT_FOUND` | No plan exists for the task | Run `vibe plan` first |
| `STEP_NOT_FOUND` | Step number not in plan | Check plan with `vibe show` |
| `STEP_ALREADY_COMMITTED` | Step was already committed | Move to the next step |
| `DIFF_OUT_OF_SCOPE` | Changed files outside step scope | Ensure changes match expectedFiles directory |
| `PLAN_NOT_APPROVED` | Tried to execute before the plan was approved | Run `vibe review`, resolve open questions, re-plan until approved |
| `VERIFY_FAILED` | Verification commands failed | Fix issues and retry |
| `STATE_CORRUPTED` | Internal state inconsistency | Check logs, may need `vibe clean` + restart |
| `JIRA_FETCH_FAILED` | Cannot fetch Jira issue | Check Jira connectivity and permissions |

---

## Best Practices for Agents

1. **Never skip the plan → review loop** — run `vibe review` after `vibe plan`, and keep looping (plan → review → plan) until it reports `approved: true`. Execution is blocked before approval.
2. **Ask the user on divergence/uncertainty** — when review surfaces open questions (or you hit any ambiguous/divergent decision), pause and ask the user; fold answers into the next `vibe plan`. Don't guess on decisions that change the plan.
3. **Never auto-push or auto-create PRs** — `vibe pr` produces a draft only. Stop there and let the user review; `git push` and PR creation are manual, user-triggered actions.
4. **Always use `vibe done` instead of `vibe code` + `vibe commit`** — it's atomic and handles staging automatically
5. **Read the plan before implementing** — use `vibe show` to understand expectedFiles and commit messages
6. **One step at a time** — implement, commit, then move to the next step
7. **Don't manually `git add` or `git commit`** — vibe-cli handles this
8. **Respect step scope** — changes should be in or near the expectedFiles directory
9. **Use `--dry-run` for preview** — if unsure, run with `--dry-run` first to see what would happen
10. **Check `vibe resume` if interrupted** — it tells you the next recommended action
11. **Update verify commands if needed** — if `vibe verify` fails with command not found, update `.vibe/config.json`

---

## Example: Complete Task Flow

```bash
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