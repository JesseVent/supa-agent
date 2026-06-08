# Security & Permissions

> 🚧 **Beta Stage**
> Current features are incomplete and the API may change at any time. Please do not use in production environments before the official release.

page-agent provides multiple security mechanisms to ensure AI operations stay within controlled boundaries.

## Element Interaction Allowlist/Blocklist

**Blocklist** — Prevent AI from interacting with sensitive elements like delete buttons, payment buttons, etc.

**Allowlist** — Explicitly define which elements AI can interact with.

## Instruction Safety Constraints

**High-Risk Operation Control** — Define high-risk operations in AI instructions and control them through two strategies:

**Completely Forbidden** — Explicitly prohibit execution of extremely high-risk operations.

**Requires User Confirmation** — Require explicit user consent for medium-risk operations.
