#!/usr/bin/env node
/**
 * Backup package.json, then rewrite it for publish:
 *   - Promote `publishConfig` fields to top level
 *   - Remove `publishConfig` (npm doesn't need the wrapper)
 *   - Copy LICENSE (and README.md for the main package)
 *
 * Usage: node ../../scripts/pre-publish.js   (from a package dir)
 */
import { copyFileSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const pkgPath = join(process.cwd(), 'package.json')
const raw = readFileSync(pkgPath, 'utf-8')
const pkg = JSON.parse(raw)

const publishConfig = pkg.publishConfig
if (!publishConfig) {
	process.exit(0)
}

// Backup the original file byte-for-byte
copyFileSync(pkgPath, `${pkgPath}.bak`)

for (const [field, value] of Object.entries(publishConfig)) {
	pkg[field] = value
}
delete pkg.publishConfig

writeFileSync(pkgPath, `${JSON.stringify(pkg, null, '    ')}\n`)

const root = join(process.cwd(), '../..')
copyFileSync(join(root, 'LICENSE'), join(process.cwd(), 'LICENSE'))

if (pkg.name === 'supa-agent') {
	copyFileSync(join(root, 'README.md'), join(process.cwd(), 'README.md'))
}
