# Contributing to SupaAgent

♥️ We welcome contributions from everyone.

For local development workflows, setup, local LLM config, extension development, testing on other websites, and more details, see [docs/developer-guide.md](docs/developer-guide.md).

## 🤝 How to Contribute

### Opening Issues

- Use the GitHub issue tracker to report bugs or request features
- Search existing issues before creating new ones
- Provide clear reproduction steps for bugs
- Include browser version and environment details

### Code Contributions

1. Follow existing code style and patterns
2. Update documentation as needed
3. Add JSDoc for public APIs
4. Build and lint everything
5. Test in our demo website, and on other websites if applicable
6. Include screenshots for UI changes

### Vibe Coding with AI

- Vibe coding is **NOT** allowed for the core lib or the extension!!!
- Vibe coding is **RECOMMENDED** when maintaining **the demo, the website, the UI and tests**.
- Make sure your AI references `AGENTS.md` and `website/AGENTS.md` for better quality.
- Review anything AI wrote before make a commit. You are the author of anything you commit. NOT AI.

## 🚫 What We Don't Accept

- Breaking changes and large PRs without prior discussion
- Heavy dependencies to core libs
- Dependencies or code with licenses incompatible with MIT
- Bot or AI-generated pull requests without meaningful human involvement

## 📄 Legal

By contributing to this project, you agree that your contributions will be licensed under the MIT License.

---

## 🧹 Lint & Format

[Biome](https://biomejs.dev) is the linter and formatter (replaces ESLint + Prettier). Run before pushing:

```bash
bun run lint       # biome check . (lint + format-check + import sort)
bun run format     # biome format --write . (apply formatting)
```

The pre-commit hook (`.husky/pre-commit`) runs Biome on staged files via `lint-staged`.

Coverage is slightly different from the prior ESLint setup:

- Biome's React/JSX a11y rules are **enabled** — most of the warnings that `@eslint-react/eslint-plugin` would have caught still fire
- A handful of rules are turned off in `biome.json` to keep noise low (no `noExplicitAny`, no `noNonNullAssertion`, no `useImportType`); see the comments in the config for the full list
- Three pre-existing `lint` errors remain (the `eval()` in `PageController.ts` and two findings in the legacy `dom_tree/index.js`); they are tracked separately

---

## 📦 Publishing (maintainers only)

Publishing is intentionally manual and guarded. A bare `npm publish` (or a stray CI step) will be aborted.

- The root `prepublishOnly` and every package's `prepublishOnly` chain into `scripts/publish-guard.js`.
- The guard checks for `SUPA_AGENT_PUBLISH_CONFIRM=1` in the environment. If it is not set, the publish fails with a non-zero exit before any upload.
- The package-level `prepublishOnly` then runs `scripts/pre-publish.js` to swap `publishConfig` → top-level and copy `LICENSE` / `README.md` into the package, and `postpublish` restores the source-first layout via `scripts/post-publish.js`.

To publish intentionally:

```bash
SUPA_AGENT_PUBLISH_CONFIRM=1 npm publish
SUPA_AGENT_PUBLISH_CONFIRM=1 npm publish -w supa-agent
SUPA_AGENT_PUBLISH_CONFIRM=1 npm publish -w @supa-agent/core
```

### Renaming the npm package

The npm package name is the same as the GitHub repo (`supa-agent`) and is currently being transitioned from the legacy name. Before publishing under the new name for the first time, the maintainer must:

1. Mark the legacy package as deprecated on npm with a pointer to the new name, so existing users get a notice on install.
2. Publish the new package at the new name and version.
3. Cut a release with a CHANGELOG entry that announces the rename and the deprecation timeline.

Until those steps are done, do not run `npm publish` against the new name.

---

Thank you for helping make SupaAgent better! 🎉
