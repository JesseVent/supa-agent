/**
 * Check if a URL's hostname is allowed by the given domain list.
 *
 * Rules:
 * - Empty list or ['*'] → allow all
 * - `example.com` → matches `example.com` and `*.example.com`
 * - `*.example.com` → matches subdomains only
 */
export function isDomainAllowed(url: string, allowedDomains: string[] | undefined): boolean {
	if (!allowedDomains || allowedDomains.length === 0) return true

	const normalized = allowedDomains.map((d) => d.trim().toLowerCase()).filter((d) => d.length > 0)

	if (normalized.length === 0 || normalized.includes('*')) return true

	let hostname: string
	try {
		hostname = new URL(url).hostname.toLowerCase()
	} catch {
		return false
	}

	return normalized.some((domain) => {
		const bare = domain.replace(/^\*\./, '')
		if (domain.startsWith('*.')) {
			return hostname.endsWith(`.${bare}`)
		}
		return hostname === bare || hostname.endsWith(`.${bare}`)
	})
}
