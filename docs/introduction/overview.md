# Overview

SupaAgent is an AI-powered browser automation tool with native Supabase integration. It lets you control web pages using natural language and query your Supabase project directly from the browser.

## What is SupaAgent?

SupaAgent runs as a Chrome extension side panel. You describe what you want done, and the agent clicks, types, scrolls, navigates across tabs, and queries your Supabase database — all without you touching the browser manually.

It is built for developers who want to:

- Automate repetitive browser workflows
- Query and manage a Supabase project without opening the dashboard
- Give a web application a natural-language interface for end users
- Connect local or cloud AI agents to the browser via MCP

## Core Features

- **Smart DOM Analysis** — DOM-based analysis with high-intensity dehydration. No visual recognition needed. Pure text for fast and precise element targeting.
- **Supabase MCP** — OAuth-authenticated connection to `mcp.supabase.com`. Query the database, inspect logs, manage edge functions, and check project health using natural language.
- **Multi-page Automation** — Run tasks across multiple pages and tabs from a single instruction.
- **OpenRouter Support** — Works with Claude, Gemini, GPT, DeepSeek, Grok, and any OpenRouter-compatible model. No vendor lock-in.
- **MCP Server** — Expose browser control to external agents (Claude Desktop, Cursor, etc.) via the `@supa-agent/mcp` package.
- **Headless Core** — Use `@supa-agent/core` without any UI for server-side automation or testing.
- **Skill Router** — Inject domain knowledge from an external knowledge base into the agent context.

## vs. browser-use

| | SupaAgent | browser-use |
|---|---|---|
| Deployment | Embedded Chrome extension + JS library | External Python tool |
| Scope | Current page or multi-tab | Entire browser via Playwright |
| Supabase integration | Native OAuth + MCP tools | None built-in |
| Target Users | Web developers, Supabase users | Scraper/automation developers |
| Use Case | App UX enhancement + DB management | General browser automation |

## Use Cases

1. **Supabase DB Management** — Ask the agent to query tables, inspect RLS policies, check slow query logs, or summarise your schema — no SQL client needed.
2. **Multi-page Workflows** — Fill forms, navigate dashboards, collect data across tabs, and submit reports without manual steps.
3. **Legacy App Modernisation** — Add a natural-language interface to complex B2B software with one script tag.
4. **Interactive Training** — Demonstrate workflows in real-time. Let AI show the complete process of "how to submit an expense report."
5. **Accessibility** — Provide natural language interaction for users who struggle with complex UIs.
