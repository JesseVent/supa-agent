// @ts-check
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import dts from 'unplugin-dts/vite'
import { defineConfig } from 'vite'
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ES Module for NPM Package
export default defineConfig({
	clearScreen: false,
	plugins: [
		dts({
			bundleTypes: true,
			compilerOptions: {
				composite: true,
				noEmit: false,
				emitDeclarationOnly: true,
				declaration: true,
			},
		}),
		cssInjectedByJsPlugin({ relativeCSSInjection: true }),
	],
	publicDir: false,
	build: {
		lib: {
			entry: resolve(__dirname, 'src/SupaAgentCore.ts'),
			name: 'SupaAgentCore',
			fileName: 'supa-agent-core',
			formats: ['es'],
		},
		outDir: resolve(__dirname, 'dist', 'esm'),
		rollupOptions: {
			external: [
				'chalk',
				'zod',
				'zod/v4',
				// all the internal packages
				/^@supa-agent\//,
			],
		},
		minify: false,
		sourcemap: true,
		cssCodeSplit: true,
	},
	define: {
		'process.env.NODE_ENV': '"production"',
	},
})
