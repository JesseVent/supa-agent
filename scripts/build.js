#!/usr/bin/env node
import { execSync } from 'node:child_process'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')
execSync('rm -rf packages/extension/.output packages/extension/output packages/extension/dist', {
	cwd: rootDir,
	stdio: 'inherit',
})
execSync('npm run zip', { cwd: join(rootDir, 'packages/extension'), stdio: 'inherit' })
