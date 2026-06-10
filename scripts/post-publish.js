#!/usr/bin/env node
/**
 * Restore package.json from the backup created by pre-publish.js,
 * then clean up temporary files (backup, LICENSE, README.md).
 *
 * Usage: node ../../scripts/post-publish.js   (from a package dir)
 */
import { existsSync, readFileSync, renameSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const pkgPath = join(process.cwd(), 'package.json')
const bakPath = `${pkgPath}.bak`

if (!existsSync(bakPath)) {
	process.exit(0)
}

const name = JSON.parse(readFileSync(pkgPath, 'utf-8')).name

renameSync(bakPath, pkgPath)

rmSync(join(process.cwd(), 'LICENSE'), { force: true })

if (name === 'supa-agent') {
	rmSync(join(process.cwd(), 'README.md'), { force: true })
}
