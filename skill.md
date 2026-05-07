# Vibe-CLI Skill Guide for AI Agents

## Overview

`vibe-cli` is a Jira-driven step-based vibe coding workflow CLI. It orchestrates the full lifecycle of a development task: from Jira issue analysis, through planning and execution, to PR generation. As an AI agent, you use vibe-cli to manage structured, auditable, and incremental code changes tied to Jira tickets.

**Binary:** `vibe` (run from the project root directory)

---

## Workflow Lifecycle

```
start → context → plan → [done --step N per step] → verify → pr
```

| Phase | Command | Description |
|-------|---------|-------------|
| 1. Initialize | `vibe start <JIRA_KEY>` | Create branch, fetch Jira issue, save context |
| 2. Context | `vibe context <JIRA_KEY>` | Resolve Figma/Confluence links, analyze repo |
| 3. Plan | `vibe plan <JIRA_KEY>` | Generate step-by-step execution plan |
| 4. Execute | `vibe done <JIRA_KEY> --step <N>` | Execute a step and commit in one atomic operation |
| 5. Verify | `vibe verify <JIRA_KEY>` | Run task-level verification (lint, typecheck, test) |
| 6. PR | `vibe pr <JIRA_KEY>` | Generate PR draft report |

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

**After this:** Run `vibe done <JIRA_KEY> --step <N>` for each step, starting from step 1.

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

**Purpose:** Generate a PR draft report.

**What it does:**
1. Gathers issue context, links, plan, and progress
2. Fetches GitHub PR context (existing related PRs, compare URL)
3. Generates a PR description with AI disclosure, reviewer assignments
4. Saves the draft as `pr.md` in the task's reports directory

**Usage:**
```bash
vibe pr CRMCN-11400
```

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
3. vibe plan <JIRA_KEY>           # Generate execution plan
4. vibe show <JIRA_KEY>           # Review the plan and step details
```

### Phase 2: Implementation (per step)

For each step N in the plan (starting from 1):

```
5. [Make the code changes for step N in the codebase]
6. vibe done <JIRA_KEY> --step N  # Execute report + auto-stage + commit
```

**Important agent behaviors during implementation:**
- Read the plan's `expectedFiles` for each step to understand scope
- The `done` command will auto-stage and commit — do NOT run `git add` or `git commit` manually
- If you need to refactor a file into a directory (e.g., `details.tsx` → `details/index.tsx`), the directory-level scope check will allow it
- Commit messages in the plan are pre-formatted; if you change the plan, use prefixes: `feat`, `refactor`, `fix`, or `style`

### Phase 3: Verification & PR

```
7. vibe verify <JIRA_KEY>         # Run lint/typecheck/test
8. vibe pr <JIRA_KEY>             # Generate PR draft (optional)
```

---

## State Management

Vibe-cli maintains state in `.vibe/tasks/<JIRA_KEY>/`:

| File | Content |
|------|---------|
| `issue.json` | Jira issue data |
| `links.json` | External links (Figma, Confluence) |
| `repo-context.json` | Local repo analysis |
| `plan.json` | Execution plan with step statuses |
| `progress.json` | Task progress, commits, current step |
| `reports/` | Generated reports (context.md, plan.md, verify-report.md, pr.md) |
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
initialized → context_ready → planned → coding → verifying → pr_ready
```

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
    "maxFilesPerStep": 6
  },
  "verify": {
    "stepCommands": ["pnpm lint"],
    "taskCommands": ["pnpm lint", "pnpm typecheck", "pnpm test --changed"]
  }
}
```

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
| `VERIFY_FAILED` | Verification commands failed | Fix issues and retry |
| `STATE_CORRUPTED` | Internal state inconsistency | Check logs, may need `vibe clean` + restart |
| `JIRA_FETCH_FAILED` | Cannot fetch Jira issue | Check Jira connectivity and permissions |

---

## Best Practices for Agents

1. **Always use `vibe done` instead of `vibe code` + `vibe commit`** — it's atomic and handles staging automatically
2. **Read the plan before implementing** — use `vibe show` to understand expectedFiles and commit messages
3. **One step at a time** — implement, commit, then move to the next step
4. **Don't manually `git add` or `git commit`** — vibe-cli handles this
5. **Respect step scope** — changes should be in or near the expectedFiles directory
6. **Use `--dry-run` for preview** — if unsure, run with `--dry-run` first to see what would happen
7. **Check `vibe resume` if interrupted** — it tells you the next recommended action
8. **Update verify commands if needed** — if `vibe verify` fails with command not found, update `.vibe/config.json`

---

## Example: Complete Task Flow

```bash
# 1. Start task
vibe start CRMCN-11400

# 2. Build context
vibe context CRMCN-11400

# 3. Generate plan
vibe plan CRMCN-11400

# 4. Review plan
vibe show CRMCN-11400

# 5. Implement step 1 (e.g., add API types and i18n keys)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 1

# 6. Implement step 2 (e.g., build table component with filters)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 2

# 7. Implement step 3 (e.g., refactor into folder structure)
#    [make code changes in the codebase]
vibe done CRMCN-11400 --step 3

# 8. Verify all changes
vibe verify CRMCN-11400

# 9. Generate PR draft (optional)
vibe pr CRMCN-11400