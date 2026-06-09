# PageController

PageController handles DOM extraction and element interaction, independent of LLM. It structures page state into LLM-consumable format and executes element-level actions.

## Basic Usage

SupaAgent accepts PageController options:

```typescript
import { SupaAgent } from 'supa-agent'

const agent = new SupaAgent({
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',

  // PageController options
  enableMask: true,
  viewportExpansion: 0,
})
```

SupaAgentCore accepts a PageController instance:

```typescript
import { SupaAgentCore } from '@supa-agent/core'
import { PageController } from '@supa-agent/page-controller'

const pageController = new PageController({
  enableMask: true,
  viewportExpansion: -1,  // extract full page
})

const agent = new SupaAgentCore({
  pageController,
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',
})
```

---

## Configuration

### PageControllerConfig

| Property | Type | Default | Description |
|---|---|---|---|
| `enableMask` | `boolean` | `false` | Enable visual mask overlay that blocks user interaction during automation. Defaults to `true` when created via SupaAgent. |
| `viewportExpansion` | `number` | `0` | Pixels to expand extraction beyond viewport. Set to `-1` to extract the entire page. |
| `interactiveBlacklist` | `(Element \| (() => Element))[]` | | Elements to exclude from interaction. Supports element references or functions returning elements (lazy evaluation). |
| `interactiveWhitelist` | `(Element \| (() => Element))[]` | | Elements to force include for interaction. Supports element references or functions returning elements. |
| `includeAttributes` | `string[]` | | Additional HTML attributes to include in DOM extraction. Supports wildcard `*` (e.g. `data-*` matches all `data-`-prefixed attributes). Common attributes like `role`, `aria-label` are included by default. |
| `keepSemanticTags` | `boolean` | `false` | Preserve semantic landmark tags (e.g. `nav`, `main`, `header`, `footer`, `aside`) in dehydrated output even if not interactive. Helps LLM understand page structure. |

---

## Methods

### State Queries

| Method | Type | Description |
|---|---|---|
| `getBrowserState()` | `Promise<BrowserState>` | Get structured browser state (URL, title, simplified HTML, etc.), automatically calls `updateTree()` to refresh DOM. This is the primary method the agent uses each step. |
| `updateTree()` | `Promise<string>` | Refresh DOM tree and return simplified HTML. Usually not needed manually — `getBrowserState()` calls it automatically. |
| `getCurrentUrl()` | `Promise<string>` | Get current page URL. |

### Element Actions

| Method | Type | Description |
|---|---|---|
| `clickElement(index)` | `Promise<ActionResult>` | Click element by index. Index comes from `[N]` markers in simplified HTML. |
| `inputText(index, text)` | `Promise<ActionResult>` | Input text into a form element. |
| `selectOption(index, optionText)` | `Promise<ActionResult>` | Select option in a dropdown element. |
| `scroll(options)` | `Promise<ActionResult>` | Scroll page or specific element vertically. |
| `scrollHorizontally(options)` | `Promise<ActionResult>` | Scroll page or specific element horizontally. |

### Mask Control

| Method | Type | Description |
|---|---|---|
| `showMask()` | `Promise<void>` | Show visual mask overlay. Requires `enableMask: true`. |
| `hideMask()` | `Promise<void>` | Hide visual mask overlay. |

### Lifecycle

| Method | Type | Description |
|---|---|---|
| `dispose()` | `void` | Clean up all resources (DOM highlights, mask, etc.). Called automatically when agent disposes. |

---

## Type Definitions

### BrowserState

Structured browser state returned by `getBrowserState()`, used directly to build LLM prompts.

```typescript
interface BrowserState {
  url: string
  title: string
  header: string   // page info + scroll position
  content: string  // simplified HTML of interactive elements
  footer: string   // scroll hint
}
```

### ActionResult

```typescript
interface ActionResult {
  success: boolean
  message: string
}
```

## Custom Implementation

In non-browser environments (e.g. Puppeteer, Playwright), you can implement a custom PageController. Implement the core methods used by the agent:

```typescript
import { SupaAgentCore } from '@supa-agent/core'
import type { PageController } from '@supa-agent/page-controller'

class PuppeteerPageController implements PageController {
  async getBrowserState() { /* ... */ }
  async clickElement(index: number) { /* ... */ }
  async inputText(index: number, text: string) { /* ... */ }
  async scroll(options: { down: boolean; numPages: number }) { /* ... */ }
  // ... other methods
}

const agent = new SupaAgentCore({
  pageController: new PuppeteerPageController(),
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',
})
```
