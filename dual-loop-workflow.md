---
name: dual-loop-workflow
description: >-
  Enforces a dual-loop development workflow: plan→review→plan until uncertainty
  is low, then code→code-review→code until over-engineering risk is low, before
  commit. Use when implementing features, refactoring, writing multi-step plans,
  reviewing your own diffs, or when the user mentions plan review, code review
  loop, YAGNI, uncertainty, or dual-loop workflow.
---

# Dual-Loop Workflow

Two loops. No CLI. No plugins. Agent self-enforces both before writing code and before committing.

```
gather context → ┌──────────────────────────┐ → per step: ┌─────────────────────────────┐ → verify → stop
                 │ plan → review → plan     │              │ code → code-review → code  │
                 └──────────────────────────┘              │ → commit only when passed  │
                    until uncertainty is low               └─────────────────────────────┘
                                                              until risk is low
```

| Loop | When | Purpose |
|------|------|---------|
| **plan → review → plan** | Before any implementation | Prevention: drive down uncertainty / divergence |
| **code → code-review → code** | After writing a step, before commit | Detection: catch over-engineering on the real diff |

**Hard rules**

1. Do not implement until the plan is approved.
2. Do not commit until the step's code review is passed.
3. On divergence or uncertainty: pause and ask the user; do not guess.
4. After all work: do not auto-push or auto-create PRs; wait for explicit user approval.

---

## Phase 0: Context (lightweight)

Before planning, skim what exists:

- Task goal / acceptance criteria
- Relevant existing files and patterns
- Project conventions if present: `.cursor/rules`, `AGENTS.md`, eslint/prettier/biome, `tsconfig` (strict), package scripts

Project conventions always beat generic advice.

---

## Loop 1: plan → review → plan

### 1. Write the plan

Produce a short step-by-step plan (usually 3–7 steps). Each step includes:

- title + description
- expected files
- how to verify
- commit message intent

Also list **assumptions** and **risks**.

### 2. Self-review the plan

Score uncertainty yourself. Treat any open item as a blocker.

**Open-question categories**

| Category | Ask when… |
|----------|-----------|
| `divergence` | Multi-target differences, conflicting requirements, missing acceptance criteria, named risks |
| `scope` | Empty/TBD expected files, vague step wording, unclear file boundaries |
| `design` | Assumptions that may be false; design choices that change the plan |
| `verification` | No clear way to verify a step |
| `context` | Incomplete repo understanding; UI work with no design reference |

**Approval rule:** approve only when open questions are empty or trivial. If not approved → ask the user, fold answers into a revised plan, review again. Cap at ~3 review rounds; then ask the user whether to proceed with remaining risks called out explicitly.

### 3. Output a plan-review verdict

```markdown
## Plan Review
- Iteration: N
- Approved: yes | no

### Open Questions
- [category] question…

### Next
- if no: ask user → revise plan → re-review
- if yes: begin step 1
```

Do not start coding while `Approved: no`.

---

## Loop 2: code → code-review → code

Run once per plan step.

### 1. Code the step

- Stay inside the step's expected file scope
- Prefer editing existing files over creating new ones
- One step at a time

### 2. Self-review the diff (before commit)

Inspect the actual change set. Prefer `git diff` / changed-file list.

**Finding categories (fix over-engineering first)**

| Category | Fail when… |
|----------|------------|
| `over-engineering` | Speculative interfaces/factories/managers/wrappers/base classes for one use case; unused extension points; many pure-new files for a small need |
| `complexity` | Diff much larger than the step needs; single file doing too many jobs |
| `dependency` | New dependency without proving existing ones cannot do the job |
| `convention` | Ignores project rules/lint/tsconfig; large source change with no tests when the project has a test setup |
| `scope` | Files outside the step's expected scope |

**YAGNI checklist (must all pass)**

- [ ] No speculative abstraction
- [ ] No unused extension points / config / hooks
- [ ] Minimal diff; prefer modify/delete over add
- [ ] No unjustified new dependency
- [ ] Only files needed for this step

**External standards (optional, no plugin required):** if you can look up current library docs or design patterns, do so — then apply only what simplifies this task and does not conflict with project conventions. Never add a pattern just because it is modern.

**Approval rule:** pass only when findings are empty or trivial. If not passed → fix (over-engineering first) → re-review. Cap at ~3 rounds; then ask the user before committing with residual risk stated.

### 3. Output a code-review verdict

```markdown
## Code Review — Step N
- Iteration: N
- Passed: yes | no

### Findings
- [category] message (file if any)

### Next
- if no: fix → re-review
- if yes: commit this step only
```

Do not commit while `Passed: no`.

### 4. Commit the step

Commit only that step's changes. Then move to the next step and repeat Loop 2.

---

## After all steps

1. Run the project's normal verification (lint / typecheck / tests) if available.
2. Summarize what changed.
3. **Stop.** Do not push or open a PR unless the user explicitly asks.

---

## Progress checklist

Copy and update as you go:

```
- [ ] Context gathered
- [ ] Plan drafted
- [ ] Plan review approved (Loop 1 done)
- [ ] Step 1 coded → code-reviewed → committed
- [ ] Step 2 coded → code-reviewed → committed
- [ ] …
- [ ] Verification run
- [ ] Waiting for user before push/PR
```

---

## Anti-patterns

- Skipping either loop "to save time"
- Guessing through ambiguous requirements
- Introducing abstractions for a hypothetical second use case
- Expanding scope mid-step without re-planning
- Auto push / auto PR after finishing
