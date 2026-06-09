#!/usr/bin/env node
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { exit } from 'node:process'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = join(__dirname, '..')

const versionArg = process.argv[2]

// Read root package.json
const rootPkgPath = join(rootDir, 'package.json')
const rootPkg = JSON.parse(readFileSync(rootPkgPath, 'utf-8'))
const oldVersion = rootPkg.version
const newVersion = versionArg ?? rootPkg.version

if (!newVersion) {
	exit(1)
}

// Update root package.json if new version specified
if (versionArg) {
	rootPkg.version = newVersion
	writeFileSync(rootPkgPath, `${JSON.stringify(rootPkg, null, '    ')}\n`)
} else {
}

// Sync to all packages
const packagesDir = join(rootDir, 'packages')
const packages = readdirSync(packagesDir, { withFileTypes: true })
	.filter((d) => d.isDirectory())
	.map((d) => d.name)

let hasChanges = !!versionArg

/**
 * Check if a dependency name is a page-agent internal package
 */
function isInternalPackage(name) {
	return name === 'supa-agent' || name.startsWith('@supa-agent/')
}

/**
 * Update internal package versions in dependencies object
 * @returns {boolean} Whether any changes were made
 */
function updateInternalDeps(deps, newVersion) {
	if (!deps) return false
	let changed = false
	for (const [name, version] of Object.entries(deps)) {
		if (isInternalPackage(name) && version !== newVersion) {
			deps[name] = newVersion
			changed = true
		}
	}
	return changed
}

for (const pkg of packages) {
	const pkgPath = join(packagesDir, pkg, 'package.json')
	if (!existsSync(pkgPath)) continue

	const pkgJson = JSON.parse(readFileSync(pkgPath, 'utf-8'))
	let pkgChanged = false

	// Update package version
	if (pkgJson.version !== newVersion) {
		pkgJson.version = newVersion
		pkgChanged = true
	}

	// Update internal dependencies (dependencies only, devDeps keep "*")
	if (updateInternalDeps(pkgJson.dependencies, newVersion)) {
		pkgChanged = true
	}

	if (!pkgChanged) {
		continue
	}

	writeFileSync(pkgPath, `${JSON.stringify(pkgJson, null, '    ')}\n`)

	hasChanges = true
}

// Update CDN URLs in documentation and source files
const CDN_DEMO_URL_OLD = `https://cdn.jsdelivr.net/npm/supa-agent@${oldVersion}/dist/iife/supa-agent.demo.js`
const CDN_DEMO_URL_NEW = `https://cdn.jsdelivr.net/npm/supa-agent@${newVersion}/dist/iife/supa-agent.demo.js`
const CDN_DEMO_CN_URL_OLD = `https://registry.npmmirror.com/supa-agent/${oldVersion}/files/dist/iife/supa-agent.demo.js`
const CDN_DEMO_CN_URL_NEW = `https://registry.npmmirror.com/supa-agent/${newVersion}/files/dist/iife/supa-agent.demo.js`

const filesToUpdateCdn = ['README.md', 'docs/README-zh.md', 'packages/website/src/constants.ts']

for (const relPath of filesToUpdateCdn) {
	const filePath = join(rootDir, relPath)
	if (!existsSync(filePath)) continue

	let content = readFileSync(filePath, 'utf-8')
	const original = content

	content = content.replaceAll(CDN_DEMO_URL_OLD, CDN_DEMO_URL_NEW)
	content = content.replaceAll(CDN_DEMO_CN_URL_OLD, CDN_DEMO_CN_URL_NEW)

	if (content !== original) {
		writeFileSync(filePath, content)

		hasChanges = true
	}
}

// Show git commands hint
if (hasChanges) {
	const tagName = `v${newVersion}`
}
