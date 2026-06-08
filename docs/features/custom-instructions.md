# Instructions

Use the instructions config to inject system-level directives and page-specific context, helping the AI better understand your application.

## System Instructions

Global directives applied to all tasks. Define the AI's role, working style, and behavioral boundaries.

```javascript
const agent = new PageAgent({
  // ...other config
  instructions: {
    system: `
You are a professional e-commerce assistant.

Guidelines:
- Always confirm before submitting orders
- Double-check prices and quantities
- Report errors immediately instead of retrying blindly
`
  }
})
```

## Page Instructions

A dynamic callback invoked before each step. Returns page-specific instructions based on the current URL. Useful for providing targeted guidance on different pages.

```javascript
const agent = new PageAgent({
  // ...other config
  instructions: {
    system: 'You are an order management assistant.',

    getPageInstructions: (url) => {
      if (url.includes('/checkout')) {
        return `
This is the checkout page.
- Verify shipping address before proceeding
- Check if any discounts are applied
- Confirm the total amount with the user
`
      }

      if (url.includes('/products')) {
        return `
This is the product listing page.
- Use filters to narrow down search results
- Check stock availability before adding to cart
`
      }

      return undefined // No special instructions for other pages
    }
  }
})
```

## How It Works

Before each execution step, page-agent prepends the instructions to the user prompt:

```xml
<instructions>
<system_instructions>
You are a professional e-commerce assistant.
...
</system_instructions>
<page_instructions>
This is the checkout page.
...
</page_instructions>
</instructions>

<!-- followed by agent state, history, and browser state -->
```

- If system is empty, the `<system_instructions>` tag is omitted
- If getPageInstructions returns empty, the `<page_instructions>` tag is omitted
