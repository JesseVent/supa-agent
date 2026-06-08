# Custom Tools

Extend AI Agent capabilities by registering custom tools. Define input schemas with Zod for safe business logic invocation.

## Zod Version

Page Agent uses Zod for tool input schemas. Both Zod 3 (>=3.25.0) and Zod 4 are supported. Always import from the `zod/v4` subpath. Zod Mini is not supported.

```javascript
// Zod 3 (>=3.25.0) or Zod 4
import { z } from 'zod/v4'
```

## Define Tools

Use the `tool()` helper to define custom tools with `description`, `inputSchema`, and `execute`.

```javascript
import { z } from 'zod/v4'
import { PageAgent, tool } from 'page-agent'

const pageAgent = new PageAgent({
  customTools: {

	//
    add_to_cart: tool({
      description: 'Add a product to the shopping cart by its product ID.',
      inputSchema: z.object({
        productId: z.string(),
        quantity: z.number().min(1).default(1),
      }),
      execute: async function (input) {
        await fetch('/api/cart', {
          method: 'POST',
          body: JSON.stringify(input),
        })
        return `Added ${input.quantity}x ${input.productId} to cart.`
      },
    }),

	//
    search_knowledge_base: tool({
      description: 'Search the internal knowledge base and return relevant articles.',
      inputSchema: z.object({
        query: z.string(),
        limit: z.number().max(10).default(3),
      }),
      execute: async function (input) {
        const res = await fetch(
          `/api/kb?q=${encodeURIComponent(input.query)}&limit=${input.limit}`
        )
        const articles = await res.json()
        return JSON.stringify(articles)
      },
    }),
  },
})
```

## Override & Remove Built-in Tools

Use the same name to override a built-in tool, or set it to `null` to remove it entirely.

```javascript
const pageAgent = new PageAgent({
  customTools: {
    scroll: null, // remove scroll tool
    execute_javascript: null, // remove script execution
  },
})
```
