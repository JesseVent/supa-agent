# Troubleshooting

## Model Response Format Errors

**Symptom:** The model returns malformed tool calls, plain text, or unexpected JSON instead of structured actions.

1. **Verify model compatibility** — Not all models can handle page-agent tool definitions correctly. Check the tested models list.
2. **Check proxy/gateway parameter forwarding** — If using an API proxy or gateway, make sure the `tools` parameter is forwarded to the model provider intact. Some proxies may strip or alter this field.
3. **Get community help** — If the above steps don't help, open a [GitHub Issue](https://github.com/supabase/supabase/issues) with your model name and error details.

## Low Task Success Rate

**Symptom:** The agent appears to understand the task but frequently fails to complete it, or produces incorrect results.

Follow this diagnostic funnel from simplest to most advanced:

1. **Start with a simple instruction** — Give a concrete, single-step instruction (e.g. "click the login button"). If even simple actions fail, the issue is likely not model capability.
2. **Try the strongest model available** — Switch to the most capable model you have access to, to isolate whether it's a model intelligence issue.
3. **Improve instruction quality** — Be as specific as possible. For complex tasks, consider using another LLM to decompose and refine the user's request before execution.
4. **Provide sufficient context** — Use the instructions config to inject website descriptions, key terminology, and background context to help the agent understand the page.
5. **Check HTML sanitization output** — Inspect the sanitized HTML in dev tools to confirm that key information, text, and interactive elements are preserved correctly.

## Can't Hit Target Elements

**Symptom:** The agent repeatedly retries but keeps interacting with the wrong element, or fails to locate the correct one.

1. **Understand the reality** — Not all websites provide proper semantic HTML and accessibility labels. For such sites, DOM sanitization may not produce good enough results.
2. **Check target element type** — Verify if the target is an image, Canvas, or requires complex interactions (drag-and-drop, coordinate-based clicking). These are beyond current capabilities.
3. **Inspect sanitized HTML** — Look for missing key information or unnumbered interactive elements in the sanitized output.
4. **Inject accessibility improvements** — Inject scripts to add aria-labels, semantic attributes, and other a11y improvements to enhance DOM sanitization quality.
5. **Build a custom Tool** — For consistently difficult elements, consider building a custom Tool to interact with them directly.

## API Request Errors

**Symptom:** HTTP 400 Bad Request or similar errors when calling the LLM API.

Some LLM providers use parameter formats that are not fully compatible with the OpenAI spec, causing request validation failures.

**Solution: use customFetch**

Use the customFetch config to intercept requests and adapt parameters before sending them to the target provider:

```javascript
const agent = new PageAgent({
  // ...
  customFetch: async (url, init) => {
    // Adapt parameters for your provider
    const body = JSON.parse(init.body)
    delete body.tool_choice
    const bodyStr = JSON.stringify(body)

    return fetch(url, { ...init, body: bodyStr })
  },
})
```

See the PageAgentCore API for full customFetch documentation.
