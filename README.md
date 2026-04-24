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
- Dynamic project policy lives in the workspace state directory config, not in the business repo.
- Task state is stored in a user-level workspace state directory, not under the current project root.

## Config Examples

```json
{
  "github": {
    "repository": "lifebyte-systems/CRM-Sales-Frontend",
    "reviewerPresets": {
      "lifebyte-systems/CRM-Sales-Frontend": ["jynxioxiao-lb", "colinchen-lb"]
    }
  },
  "pr": {
    "aiDisclosure": "> This PR draft was generated with vibe-cli AI assistance. Please review all changes carefully before merging."
  }
}
```

By default the workspace state root is:

- macOS: `~/Library/Application Support/vibe-cli/workspaces/...`
- Linux: `~/.local/state/vibe-cli/workspaces/...`
- Windows: `%APPDATA%/vibe-cli/workspaces/...`

You can override the base directory with `VIBE_STATE_ROOT`.
