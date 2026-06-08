# page-agent Docs

Static documentation extracted from the original React-based docs site. English content only (the source had EN/ZH i18n — ZH was dropped to keep these readable and consistent with the rest of the repo's English-only docs).

## Introduction

- [Overview](introduction/overview.md) — what page-agent is, core features, use cases
- [Quick Start](introduction/quick-start.md) — install via CDN or NPM, first agent
- [Limitations](introduction/limitations.md) — what page-agent can and can't do
- [Troubleshooting](introduction/troubleshooting.md) — common issues and fixes

## Features

- [Models](features/models.md) — supported LLMs, baseline-tested list, local runtimes
- [Custom Tools](features/custom-tools.md) — extend the agent with Zod-defined tools
- [Instructions](features/custom-instructions.md) — system and page-level context
- [Data Masking](features/data-masking.md) — `transformPageContent` hook for PII
- [Chrome Extension](features/chrome-extension.md) — multi-page tasks, browser-level control
- [MCP Server (Beta)](features/mcp-server.md) — let local agents drive the browser
- [Third-party Agent](features/third-party-agent.md) — integrate page-agent as a tool

## Advanced

- [PageAgent](advanced/page-agent.md) — full agent class with built-in UI panel
- [PageAgentCore](advanced/page-agent-core.md) — headless core, full config & API reference
- [PageController](advanced/page-controller.md) — DOM extraction & element interaction
- [Custom UI](advanced/custom-ui.md) — replace the built-in panel via the event system
- [Security & Permissions (Beta)](advanced/security-permissions.md) — allowlist/blocklist patterns

## Project

- [Changelog](CHANGELOG.md) — version history and release notes
- [Developer Guide](developer-guide.md) — local development setup and workflow
- [Security Policy](SECURITY.md) — reporting vulnerabilities
- [Code of Conduct](CODE_OF_CONDUCT.md) — community standards
- [Terms and Privacy](terms-and-privacy.md) — usage terms and data policy
