import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Resolve workspace packages to their source entry files, mirroring the
// aliases in packages/extension/wxt.config.js. This lets cross-package
// imports resolve to source during testing without a build step.
const workspaceAliases = {
	'@supa-agent/llms': join(__dirname, 'packages/llms/src/index.ts'),
	'@supa-agent/core': join(__dirname, 'packages/core/src/SupaAgentCore.ts'),
	'@supa-agent/page-controller': join(
		__dirname,
		'packages/page-controller/src/PageController.ts'
	),
}

export default defineConfig({
	resolve: {
		alias: workspaceAliases,
	},
	test: {
		environment: 'node',
		include: ['packages/*/src/**/*.test.ts'],
	},
})
