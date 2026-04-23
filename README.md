# Vibe Flow CLI

Jira-driven, step-based vibe coding workflow CLI.

## Commands

- `vibe start <JIRA_KEY>`
- `vibe context <JIRA_KEY>`
- `vibe plan <JIRA_KEY>`
- `vibe show <JIRA_KEY>`
- `vibe code <JIRA_KEY> --step <N> [--dry-run]`
- `vibe commit <JIRA_KEY> --step <N>`
- `vibe verify <JIRA_KEY>`
- `vibe pr <JIRA_KEY>`
- `vibe resume <JIRA_KEY>`
- `vibe abort <JIRA_KEY>`

## Notes

- Local git operations stay local.
- Jira / Confluence / Figma / GitHub are abstracted behind provider interfaces.
- Jira now supports `auto`, `atlassian-mcp`, and `atlassian-plugin`; `auto` prefers MCP and falls back to plugin.
- Task state is stored under `.vibe/tasks/<JIRA_KEY>/`.
