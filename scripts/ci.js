#!/usr/bin/env node
import { execSync } from 'node:child_process'

import { parallelTask } from './parallel-task.js'

const args = new Set(process.argv.slice(2))
const skipBuild = args.has('--no-build')

function run(_label, command) {
	execSync(command, { stdio: 'inherit' })
}

function isMainBranch() {
	if (process.env.GITHUB_REF) return process.env.GITHUB_REF === 'refs/heads/main'
	try {
		return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim() === 'main'
	} catch {
		return true
	}
}

// 1. Commitlint — skip on main
if (isMainBranch()) {
} else {
	const from = execSync('git merge-base origin/main HEAD', { encoding: 'utf-8' }).trim()
	run('commitlint', `npx commitlint --from ${from} --to HEAD`)
}
await parallelTask(
	[
		{ label: 'lint', command: 'npm run lint' },
		{ label: 'format:check', command: 'npm run format:check' },
		{ label: 'typecheck', command: 'npm run typecheck' },
	],
	{ timeoutMs: 120_000 }
)

// 3. Build
if (skipBuild) {
} else {
	run('build', 'npm run build')
}
