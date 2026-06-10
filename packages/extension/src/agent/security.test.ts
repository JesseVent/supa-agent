import { describe, expect, it } from 'vitest'

import { isDomainAllowed } from './security'

describe('isDomainAllowed', () => {
	it('allows everything when the list is undefined', () => {
		expect(isDomainAllowed('https://example.com', undefined)).toBe(true)
	})

	it('allows everything when the list is empty', () => {
		expect(isDomainAllowed('https://example.com', [])).toBe(true)
	})

	it('allows everything when the list contains a wildcard "*"', () => {
		expect(isDomainAllowed('https://anything.test', ['*'])).toBe(true)
	})

	it('matches an exact domain entry against the bare host', () => {
		expect(isDomainAllowed('https://example.com', ['example.com'])).toBe(true)
	})

	it('matches an exact domain entry against a subdomain', () => {
		expect(isDomainAllowed('https://sub.example.com', ['example.com'])).toBe(true)
	})

	it('matches a "*.example.com" entry against a subdomain', () => {
		expect(isDomainAllowed('https://a.example.com', ['*.example.com'])).toBe(true)
	})

	it('does NOT match a "*.example.com" entry against the bare domain', () => {
		expect(isDomainAllowed('https://example.com', ['*.example.com'])).toBe(false)
	})

	it('returns false for a malformed URL', () => {
		expect(isDomainAllowed('not a url', ['example.com'])).toBe(false)
	})

	it('is case-insensitive for both the host and the domain list', () => {
		expect(isDomainAllowed('https://EXAMPLE.com', ['Example.COM'])).toBe(true)
	})
})
