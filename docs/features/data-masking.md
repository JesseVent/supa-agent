# Data Masking

Use the `transformPageContent` hook to process page content before sending to LLM. Useful for inspecting extraction results, modifying page info, and masking sensitive data.

## API Definition

```typescript
interface SupaAgentConfig {
  /**
   * Transform page content before sending to LLM.
   * Called after DOM extraction and simplification.
   */
  transformPageContent?: (content: string) => Promise<string> | string
}
```

## Common Masking Patterns

The following example shows how to mask common sensitive data:

```javascript
const agent = new SupaAgent({
  transformPageContent: async (content) => {
    // China phone number (11 digits starting with 1)
    content = content.replace(/\b(1[3-9]\d)(\d{4})(\d{4})\b/g, '$1****$3')

    // Email address
    content = content.replace(
      /\b([a-zA-Z0-9._%+-])[^@]*(@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b/g,
      '$1***$2'
    )

    // China ID card number (18 digits)
    content = content.replace(
      /\b(\d{6})(19|20\d{2})(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])(\d{3}[\dXx])\b/g,
      '$1********$5'
    )

    // Bank card number (16-19 digits)
    content = content.replace(/\b(\d{4})\d{8,11}(\d{4})\b/g, '$1********$2')

    return content
  }
})
```
