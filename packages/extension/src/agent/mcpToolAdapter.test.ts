import { describe, expect, it } from 'vitest'

import { jsonSchemaToZod } from './mcpToolAdapter'

describe('jsonSchemaToZod', () => {
	it('converts a string schema that accepts strings and rejects numbers', () => {
		const schema = jsonSchemaToZod({ type: 'string' })
		expect(schema.safeParse('hello').success).toBe(true)
		expect(schema.safeParse(42).success).toBe(false)
	})

	it('honours the required array on an object schema', () => {
		const schema = jsonSchemaToZod({
			type: 'object',
			properties: {
				id: { type: 'string' },
				note: { type: 'string' },
			},
			required: ['id'],
		})

		// Required key present, optional key omitted → valid.
		expect(schema.safeParse({ id: 'abc' }).success).toBe(true)
		// Required key missing → invalid.
		expect(schema.safeParse({ note: 'hi' }).success).toBe(false)
	})

	it('converts anyOf into a union', () => {
		const schema = jsonSchemaToZod({
			anyOf: [{ type: 'string' }, { type: 'number' }],
		})

		expect(schema.safeParse('text').success).toBe(true)
		expect(schema.safeParse(7).success).toBe(true)
		expect(schema.safeParse(true).success).toBe(false)
	})

	it('falls back to z.any() for an unknown/missing type', () => {
		const schema = jsonSchemaToZod({ type: 'something-unknown' })
		expect(schema.safeParse({ whatever: true }).success).toBe(true)
		expect(schema.safeParse(123).success).toBe(true)
		expect(schema.safeParse(null).success).toBe(true)
	})
})
