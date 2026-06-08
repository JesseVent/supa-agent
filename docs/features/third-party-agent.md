# Third-party Agent Integration

Integrate pageAgent as a tool in your support assistant or Agent system, becoming the eyes and hands of your Agent.

## Integration Method

### 1. Function Calling

```javascript
// Define tool
const pageAgentTool = {
  name: "page_agent",
  description: "Execute web page operations",
  parameters: {
    type: "object",
    properties: {
      instruction: { type: "string", description: "Operation instruction" }
    },
    required: ["instruction"]
  },
  execute: async (params) => {
    const result = await pageAgent.execute(params.instruction)
    return { success: result.success, message: result.data }
  }
}

// Register to your agent
```

## Use Cases

- **Smart Customer Service** — Support bots directly operate systems for users, e.g., "Help me submit a ticket"
- **📋 Business Process Assistant** — Guide new employees through complex processes, e.g., "Complete customer onboarding"
- **🎯 Personal Productivity Assistant** — Complete tasks across websites, e.g., "Book a meeting room"
- **🔧 DevOps Automation** — Operate admin panels via natural language, e.g., "Restart server"
