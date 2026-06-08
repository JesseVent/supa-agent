#!/usr/bin/env node
/**
 * Extension-only build pipeline.
 *
 * 1. cleanup extension output
 * 2. build extension zip
 */
import chalk from 'chalk'
import { execSync } from 'child_process'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const rootDir = join(dirname(fileURLToPath(import.meta.url)), '..')

// Step 1: cleanup
console.log(chalk.bgBlue.white.bold(' ▸ cleanup '))
execSync('rm -rf packages/extension/.output packages/extension/output packages/extension/dist', {
	cwd: rootDir,
	stdio: 'inherit',
})

// Step 2: build extension
console.log(chalk.bgBlue.white.bold(' ▸ build:ext '))
execSync('npm run zip', { cwd: join(rootDir, 'packages/extension'), stdio: 'inherit' })

console.log(chalk.green.bold('\n✓ Extension built\n'))
