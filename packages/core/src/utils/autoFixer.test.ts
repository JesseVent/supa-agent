import { describe, expect, it } from 'vitest'
import * as z from 'zod/v4'

import type { SupaAgentTool } from '../tools'
import { normalizeResponse } from './autoFixer'

// Minimal tool registry with a single-field tool so validateAction has a schema
// to check against (and a required key it can coerce a primitive into).
const tools = new Map<string, SupaAgentTool>([
	[
		'click_element_by_index',
		{
			description: 'Click an element by its index',
			inputSchema: z.object({ index: z.number() }),
			execute: async () => 'clicked',
		} as SupaAgentTool,
	],
])

/** Read back the normalized action from the standard AgentOutput tool_call. */
function actionOf(response: ReturnType<typeof normalizeResponse>): unknown {
	const args = response.choices[0].message.tool_calls[0].function.arguments
	return JSON.parse(args).action
}

describe('normalizeResponse', () => {
	it('passes a well-formed AgentOutput tool_calls response through', () => {
		const response = {
			choices: [
				{
					message: {
						role: 'assistant',
						tool_calls: [
							{
								function: {
									name: 'AgentOutput',
									arguments: JSON.stringify({
										action: { click_element_by_index: { index: 2 } },
									}),
								},
							},
						],
					},
				},
			],
		}

		expect(actionOf(normalizeResponse(response, tools))).toEqual({
			click_element_by_index: { index: 2 },
		})
	})

	it('wraps an action-named tool_call into { action: ... }', () => {
		const response = {
			choices: [
				{
					message: {
						role: 'assistant',
						tool_calls: [
							{
								function: {
									// Model used the action name instead of "AgentOutput".
									name: 'click_element_by_index',
									arguments: JSON.stringify({
										click_element_by_index: { index: 2 },
									}),
								},
							},
						],
					},
				},
			],
		}

		expect(actionOf(normalizeResponse(response, tools))).toEqual({
			click_element_by_index: { index: 2 },
		})
	})

	it('recovers JSON found in message.content when there are no tool_calls', () => {
		const response = {
			choices: [
				{
					message: {
						role: 'assistant',
						content: JSON.stringify({
							action: { click_element_by_index: { index: 2 } },
						}),
					},
				},
			],
		}

		expect(actionOf(normalizeResponse(response, tools))).toEqual({
			click_element_by_index: { index: 2 },
		})
	})

	it('coerces a primitive single-field action input into its object form', () => {
		const response = {
			choices: [
				{
					message: {
						role: 'assistant',
						content: JSON.stringify({
							action: { click_element_by_index: 2 },
						}),
					},
				},
			],
		}

		expect(actionOf(normalizeResponse(response, tools))).toEqual({
			click_element_by_index: { index: 2 },
		})
	})

	it('throws NO_TOOL_CALL when no action can be recovered (no fabricated wait)', () => {
		const response = {
			choices: [
				{
					message: {
						role: 'assistant',
						// Valid wrapper field (`memory`) but no `action` — must not be
						// rescued into a fake { wait: { seconds: 1 } }.
						content: '{"memory":"hi"}',
					},
				},
			],
		}

		expect(() => normalizeResponse(response, tools)).toThrow(/action/i)
	})
})
