/** window.postMessage channel used by the tab-local bridge (legacy transport) */
export const PAGE_AGENT_EXT_RESPONSE_CHANNEL = 'PAGE_AGENT_EXT_RESPONSE'

/** window.postMessage channel for page → extension requests */
export const PAGE_AGENT_EXT_REQUEST_CHANNEL = 'PAGE_AGENT_EXT_REQUEST'

/** Realtime topic prefix; full topic is `agent-trace:{sha256hex(scopeId)}` */
export const AGENT_TRACE_TOPIC_PREFIX = 'agent-trace:'

/** Table the publisher persists trace events to (broadcasts via DB trigger) */
export const AGENT_TRACE_EVENTS_TABLE = 'agent_trace_events'

/** Edge function that exchanges a Management API token for a project JWT */
export const AGENT_TRACE_TOKEN_FUNCTION = 'agent-trace-token'

/** Trace transports the extension can publish on */
export type TraceTransport = 'postMessage' | 'realtime' | 'both'
