# Custom UI

PageAgent core logic (PageAgentCore) is fully decoupled from UI through events. You can replace the built-in Panel with your own UI.

## Architecture

PageAgent consists of three independent modules that can be freely combined:

- **PageAgentCore** — Core agent logic, no UI
- **PageController** — DOM operations and visual feedback
- **UI (Panel)** — User interface, replaceable with custom implementation

---

## Event System

### Two Event Streams

PageAgentCore provides two distinct event streams for UI rendering:

| | Historical Events | Activity Events |
|---|---|---|
| Event Name | `historychange` | `activity` |
| Persistence | Persisted in `agent.history` | Transient |
| Sent to LLM | Yes | No |
| Purpose | Forms agent memory, displays history | Real-time UI feedback (e.g., loading state) |

### All Events

| Property | Type | Description |
|---|---|---|
| `statuschange` | Event | Agent status changes (idle → running → completed/error) |
| `historychange` | Event | History updated, read `agent.history` for full history |
| `activity` | `CustomEvent<AgentActivity>` | Real-time activity: `thinking`, `executing`, `executed`, `retrying`, `error` |
| `dispose` | Event | Agent is disposed |

### HistoricalEvent

Event types in `agent.history` array:

```typescript
type HistoricalEvent =
  | { type: 'step'; stepIndex: number; reflection: AgentReflection; action: Action }
  | { type: 'observation'; content: string }
  | { type: 'user_takeover' }
  | { type: 'retry'; message: string; attempt: number; maxAttempts: number }
  | { type: 'error'; message: string }
```

### AgentActivity

The detail type of `activity` events:

```typescript
type AgentActivity =
  | { type: 'thinking' }
  | { type: 'executing'; tool: string; input: unknown }
  | { type: 'executed'; tool: string; input: unknown; output: string; duration: number }
  | { type: 'retrying'; attempt: number; maxAttempts: number }
  | { type: 'error'; message: string }
```

---

## React Example

### Using React Hooks

Listen to events and update React state:

```tsx
function useAgent(agent: PageAgentCore) {
  const [status, setStatus] = useState(agent.status)
  const [history, setHistory] = useState(agent.history)
  const [activity, setActivity] = useState<AgentActivity | null>(null)

  useEffect(() => {
    const onStatus = () => setStatus(agent.status)
    const onHistory = () => setHistory([...agent.history])
    const onActivity = (e: Event) => setActivity((e as CustomEvent).detail)

    agent.addEventListener('statuschange', onStatus)
    agent.addEventListener('historychange', onHistory)
    agent.addEventListener('activity', onActivity)

    return () => {
      agent.removeEventListener('statuschange', onStatus)
      agent.removeEventListener('historychange', onHistory)
      agent.removeEventListener('activity', onActivity)
    }
  }, [agent])

  return { status, history, activity }
}
```

---

## Complete Assembly Example

### Assembling Core + Controller + Custom UI

Following the built-in PageAgent pattern, replace Panel with custom UI:

```typescript
import { PageAgentCore } from '@page-agent/core'
import { PageController } from '@page-agent/page-controller'

// 1. Create PageController
const pageController = new PageController({ enableMask: true })

// 2. Create PageAgentCore with controller
const agent = new PageAgentCore({
  pageController,
  baseURL: 'https://api.openai.com/v1',
  apiKey: 'your-api-key',
  model: 'gpt-5.2',
})

// 3. Mount your custom UI
const root = createRoot(document.getElementById('my-ui')!)
root.render(<MyAgentUI agent={agent} />)

// 4. Handle user input (optional)
agent.onAskUser = async (question) => window.prompt(question) || ''

// 5. Execute task
await agent.execute('Fill the form with test data')

// 6. Cleanup
agent.dispose()
```
