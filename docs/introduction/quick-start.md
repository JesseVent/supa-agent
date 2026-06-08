# Quick Start

Integrate page-agent in minutes.

## Installation Steps

### Quick Try

> ⚠️ This demo CDN uses OpenRouter API. By using it you agree to the [Terms of Use](https://supabase.com/docs/terms).

```html
<script src="DEMO_CDN_URL" crossorigin="true"></script>
```

Add `?autoInit=false` to load the script without creating the demo agent automatically. You can then instantiate it with `new window.PageAgent(...)`.

| Mirrors | URL |
|---|---|
| Global | `https://cdn.jsdelivr.net/npm/page-agent@1.8.2/dist/iife/page-agent.demo.js` |
| China | |

### NPM Install (Recommended)

```bash
// npm install page-agent

import { PageAgent } from 'page-agent'
```

### 2. Initialize Configuration

```javascript
const agent = new PageAgent({
  model: 'minimax/minimax-m3',
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: 'YOUR_API_KEY',
  language: 'en-US'
})
```

### 3. Start Using

```javascript
// Execute natural language instructions programmatically
await agent.execute('Click submit button, then fill username as John');

// Or:
// Show panel for user to input instructions
agent.panel.show()
```
