# SupaAgentCore

SupaAgentCore is the core Agent class without UI. Use it for custom UI or headless scenarios.

## When to Use SupaAgentCore

- Need a custom UI interface
- Running headless in automated tests
- Running in non-browser environments (requires custom PageController)
- Embedding SupaAgent in other agent systems

## Basic Usage

```typescript
import { SupaAgentCore } from '@supa-agent/core'
import { PageController } from '@supa-agent/page-controller'

const agent = new SupaAgentCore({
  pageController: new PageController({ enableMask: true }),
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',
})

// Listen to events for UI display
agent.addEventListener('statuschange', () => {
  console.log('Status:', agent.status)
})

agent.addEventListener('activity', (e) => {
  const activity = (e as CustomEvent).detail
  console.log('Activity:', activity.type)
})

// Execute task
const result = await agent.execute('Fill in the form with test data')
```

---

## Configuration

`SupaAgentCoreConfig = AgentConfig & { pageController: PageController }`. AgentConfig contains the following options:

### PageController

| Property | Type | Required | Description |
|---|---|---|---|
| `pageController` | `PageController` | ✓ | PageController instance for DOM operations and element interaction. |

### LLM Config

| Property | Type | Required | Default | Description |
|---|---|---|---|---|
| `baseURL` | `string` | ✓ | | Base URL of the LLM API (e.g., `https://api.openai.com/v1`) |
| `model` | `string` | ✓ | | Model name (e.g., `gpt-5.2`, `anthropic/claude-4.5-haiku`) |
| `apiKey` | `string` | | | LLM AK |
| `temperature` | `number` | | | Model temperature, controls output randomness |
| `maxRetries` | `number` | | `3` | Maximum retries on API failure |
| `transformRequestBody` | `(requestBody) => Record<string, unknown> \| undefined` | | | Transform the final request body before sending it. Useful for provider-specific cache hints or private request parameters. See prompt caching examples. |
| `disableNamedToolChoice` | `boolean` | | `false` | Disable named `tool_choice`, always use `"required"` string. For LLM services that don't support the object format of `tool_choice`. |
| `customFetch` | `typeof fetch` | | | Custom fetch function for customizing headers, credentials, proxy, etc. |

### Agent Config

| Property | Type | Default | Status | Description |
|---|---|---|---|---|
| `language` | `'en-US'` | `'en-US'` | | Agent output language |
| `maxSteps` | `number` | `40` | | Maximum number of steps per task |
| `customTools` | `Record<string, SupaAgentTool \| null>` | | experimental | Custom tools to extend or override built-in tools. Set to `null` to remove a tool. |
| `instructions` | `InstructionsConfig` | | | Instructions to guide agent behavior, see type definition below |
| `transformPageContent` | `(content: string) => string \| Promise<string>` | | | Transform page content before sending to LLM, useful for data masking |
| `customSystemPrompt` | `string` | | experimental | Completely override the default system prompt. Use with caution. |
| `experimentalScriptExecutionTool` | `boolean` | `false` | experimental | Enable experimental JavaScript execution tool |
| `experimentalLlmsTxt` | `boolean` | `false` | experimental | Fetch `/llms.txt` from site origin and include as LLM context |

### Lifecycle Hooks ⚠️ *experimental*

> These APIs are highly experimental and may change in future versions.

| Property | Type | Description |
|---|---|---|
| `onBeforeStep` | `(agent, stepCount) => void \| Promise<void>` | Called before each step execution |
| `onAfterStep` | `(agent, history) => void \| Promise<void>` | Called after each step execution |
| `onBeforeTask` | `(agent) => void \| Promise<void>` | Called before task starts |
| `onAfterTask` | `(agent, result) => void \| Promise<void>` | Called after task ends |
| `onDispose` | `(agent, reason?) => void` | Called when agent is disposed |

---

## Properties & Methods

### Properties

| Property | Type | Description |
|---|---|---|
| `status` | `'idle' \| 'running' \| 'completed' \| 'error'` | Current agent execution status |
| `history` | `HistoricalEvent[]` | Array of historical events, forms agent memory |
| `task` | `string` | Current task being executed |
| `pageController` | `PageController` | PageController instance for DOM operations |
| `tools` | `Map<string, SupaAgentTool>` | Map of available tools |
| `onAskUser` | `(question: string) => Promise<string>` | Callback when agent needs user input. If not set, `ask_user` tool is disabled. |

### Methods

| Method | Type | Description |
|---|---|---|
| `execute(task)` | `Promise<ExecutionResult>` | Execute a task and return result. Contains `success`, `data`, and `history` fields. |
| `stop()` | `void` | Stop the current task. Agent remains reusable. |
| `dispose()` | `void` | Dispose the agent and clean up resources |

### Events

SupaAgentCore extends `EventTarget` and provides the following events:

| Property | Type | Description |
|---|---|---|
| `statuschange` | Event | Fired when agent status changes (idle → running → completed/error) |
| `historychange` | Event | Fired when history events are updated (persistent, part of agent memory) |
| `activity` | `CustomEvent<AgentActivity>` | Real-time activity feedback (transient, UI only). Types: `thinking`, `executing`, `executed`, `retrying`, `error` |
| `dispose` | Event | Fired when agent is disposed |

---

## Type Definitions

### ExecutionResult

```typescript
interface ExecutionResult {
  success: boolean
  data: string
  history: HistoricalEvent[]
}
```

### AgentActivity

```typescript
type AgentActivity =
  | { type: 'thinking' }
  | { type: 'executing'; tool: string; input: unknown }
  | { type: 'executed'; tool: string; input: unknown; output: string; duration: number }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'error'; message: string }
```

### InstructionsConfig

```typescript
interface InstructionsConfig {
  /** Global system-level instructions, applied to all tasks */
  system?: string

  /**
   * Dynamic page-level instructions callback.
   * Called before each step to get instructions for the current page.
   */
  getPageInstructions?: (url: string) => string | undefined
}
```
