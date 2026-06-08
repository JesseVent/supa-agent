# Limitations

Page Agent understands web pages via DOM and performs actions accordingly. This defines its capability boundary.

## PageAgent.js vs PageAgentExt

PageAgent.js is the core library running inside a page. PageAgentExt is an optional browser extension that adds browser-level control.

| | PageAgent.js | PageAgentExt |
|---|---|---|
| Integration | Site developer integrates the library | User installs a browser extension |
| Scope | Current page (designed for SPAs) | Any web page, multi-tab |
| Extra capabilities | — | Open / switch / close tabs |

## Interaction Capabilities

**Supported:**

- Click, text input, select
- Scroll (vertical / horizontal)
- Form submit, focus
- Same-origin iframe (single level only)
- Execute JavaScript (opt-in)

**Not supported:**

- Hover, drag & drop, right-click
- Keyboard shortcuts
- Position-based control
- Nested iframes, cross-origin iframes
- Drawing
- Monaco, CodeMirror and other editors that require JS instance access

## Text-Based Approach

Page Agent does not use multimodal models, does not take screenshots, and has no visual capability. It reads pages through DOM structure only.

Images, Canvas, WebGL, SVG and other visual content cannot be recognized. Page semantic quality and accessibility directly affect AI accuracy.

Counter-intuitive interactions, visual-only cues, and rapidly appearing/disappearing elements reduce automation success. Semantic HTML and good accessibility significantly improve results.
