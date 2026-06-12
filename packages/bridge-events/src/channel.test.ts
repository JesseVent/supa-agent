import { describe, expect, it } from 'vitest'
import { getChannelName, sha256Hex } from './channel'

describe('getChannelName', () => {
	// Fixed vector — must match the SQL helper on the Realtime host project:
	//   select public.agent_trace_topic('b3c95df0-96f8-4f37-a078-8a6d78b1ad95'::uuid);
	const userId = 'b3c95df0-96f8-4f37-a078-8a6d78b1ad95'
	const expectedTopic =
		'agent-trace:906d2f42b91a68d2e84e76123a409e3b8d7d3d1cdd808a72ccdeaad36cf3540b'

	it('hashes the scope id into the topic', async () => {
		await expect(getChannelName(userId)).resolves.toBe(expectedTopic)
	})

	it('normalizes case and whitespace so JS and SQL derive the same topic', async () => {
		await expect(getChannelName(` ${userId.toUpperCase()} `)).resolves.toBe(expectedTopic)
	})

	it('produces RFC-test-vector sha256 output', async () => {
		await expect(sha256Hex('abc')).resolves.toBe(
			'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'
		)
	})
})
