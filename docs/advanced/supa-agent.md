# SupaAgent

SupaAgent is the complete Agent class with built-in UI panel. It extends SupaAgentCore and automatically creates an interactive panel and PageController.

## When to Use SupaAgent

In most cases, you should use SupaAgent. It provides a complete out-of-the-box experience:

- Automatically creates PageController for DOM extraction and element actions
- Built-in UI panel showing task progress, agent thinking, and action results
- Supports `ask_user` tool for agent to ask questions to users

## Basic Usage

```typescript
import { SupaAgent } from 'supa-agent'

const agent = new SupaAgent({
  // LLM Configuration (required)
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',

  // Optional settings
  language: 'en-US',
})

// Execute a task
const result = await agent.execute('Click the login button')

console.log(result.success) // true or false
console.log(result.data)    // Task result description
console.log(result.history) // Full execution history
```

## Class Definition

```typescript
class SupaAgent extends SupaAgentCore {
  panel: Panel
  pageController: PageController
  constructor(config: SupaAgentConfig)
}
```

SupaAgent extends SupaAgentCore. All core methods and events are available. Config merges AgentConfig, PanelConfig, and PageControllerConfig.

## UI Panel

SupaAgent automatically creates a Panel instance. You can control the UI via the `panel` property:

```typescript
// Show/hide the panel
agent.panel.show()
agent.panel.hide()

// Expand/collapse history view
agent.panel.expand()
agent.panel.collapse()

// Reset panel state
agent.panel.reset()

// Dispose panel (called automatically when agent disposes)
agent.panel.dispose()
```

## SupaAgent vs SupaAgentCore

| | SupaAgent | SupaAgentCore |
|---|---|---|
| UI Panel | ✓ | - |
| Auto-creates PageController | ✓ | - |
| Headless Mode | - | ✓ |
| Use Case | Web integration | Custom UI / Headless |
