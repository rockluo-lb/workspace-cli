# Vibe Flow CLI

Jira-driven, step-based vibe coding workflow CLI. Run commands from the repository you want to change. Task state is stored under `~/.vibe/`.

## Usage

Node.js `>= 22`. Build, then register `vibe` globally:

```bash
pnpm install
pnpm build
pnpm link --global
```

If the shell cannot find `vibe`, run `pnpm setup`, reopen the shell, and link again. Source changes only need another `pnpm build`. Remove the global command with `pnpm unlink --global`.

Without a global install:

```bash
pnpm dev -- start PROJ-123
```

In the target repository:

```bash
vibe start PROJ-123
vibe context PROJ-123
vibe plan PROJ-123
vibe review PROJ-123
vibe code PROJ-123 --step 1
vibe commit PROJ-123 --step 1
vibe verify PROJ-123
vibe pr PROJ-123
```

Other commands: `skill`, `adopt`, `show`, `brief`, `handoff`, `scope`, `code-review`, `done`, `fix`, `learn`, `memory`, `resume`, `abort`, `clean`. Run `vibe --help` for options.
