#!/usr/bin/env node
import crypto from 'node:crypto'
import { readFileSync } from 'node:fs'
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { WebSocketServer } from 'ws'

const EXT_ID = 'akldabonmimlicnjlflnapfeklbfemhj'
const STORE_URL = `https://chromewebstore.google.com/detail/supa-agent-ext/${EXT_ID}`
const LOOPBACK_HOST = 'localhost'

const PKG_VERSION = JSON.parse(
	readFileSync(new URL('../package.json', import.meta.url), 'utf-8')
).version

const launcherTemplate = readFileSync(
	fileURLToPath(new URL('./launcher.html', import.meta.url)),
	'utf-8'
)

/**
 * HTTP + WebSocket bridge to the hub.html extension tab.
 * - HTTP serves the launcher page (triggers extension to open hub)
 * - WS carries execute/stop commands and result/error responses
 */
export class HubBridge {
	/** @type {number} */
	port

	/** @type {string} */
	token

	/** @type {http.Server} */
	#httpServer

	/** @type {WebSocketServer} */
	#wss

	/** @type {import('ws').WebSocket | null} */
	#hub = null

	/** @type {{ resolve: (r: {success: boolean, data: string}) => void, reject: (e: Error) => void } | null} */
	#pendingTask = null

	/** @param {number} port */
	constructor(port) {
		this.port = port
		this.token = crypto.randomUUID()
		this.#httpServer = http.createServer((_req, res) => {
			const html = launcherTemplate
				.replaceAll('__EXT_ID__', EXT_ID)
				.replaceAll('__STORE_URL__', STORE_URL)
				.replaceAll('__WS_PORT__', String(port))
				.replaceAll('__WS_TOKEN__', this.token)
			res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
			res.end(html)
		})
		this.#wss = new WebSocketServer({ server: this.#httpServer })
		this.#wss.on('connection', (ws, req) => this.#onConnection(ws, req))
	}

	/** @returns {Promise<void>} */
	async start() {
		return new Promise((resolve, reject) => {
			this.#httpServer.on('error', (/** @type {NodeJS.ErrnoException} */ err) => {
				if (err.code === 'EADDRINUSE') {
					reject(
						new Error(
							`Port ${this.port} is in use. Another SupaAgent MCP server may be running.`
						)
					)
				} else {
					reject(err)
				}
			})
			this.#httpServer.listen(this.port, LOOPBACK_HOST, () => {
				console.error(`[supa-agent-mcp] HTTP + WS on http://${LOOPBACK_HOST}:${this.port}`)
				resolve()
			})
		})
	}

	get connected() {
		return this.#hub?.readyState === 1
	}

	get busy() {
		return this.#pendingTask !== null
	}

	/**
	 * @param {string} task
	 * @param {Record<string, unknown>} [config]
	 * @returns {Promise<{success: boolean, data: string}>}
	 */
	async executeTask(task, config) {
		if (!this.connected) throw new Error('Hub is not connected. Is the extension running?')
		if (this.#pendingTask) throw new Error('Agent is already running a task.')

		return new Promise((resolve, reject) => {
			this.#pendingTask = { resolve, reject }
			this.#hub.send(JSON.stringify({ type: 'execute', task, config }))
		})
	}

	stopTask() {
		if (this.connected) {
			this.#hub.send(JSON.stringify({ type: 'stop' }))
		}
	}

	/**
	 * @param {import('ws').WebSocket} ws
	 * @param {import('node:http').IncomingMessage} req
	 */
	#onConnection(ws, req) {
		const urlObj = new URL(req.url ?? '', 'http://localhost')
		const connToken = urlObj.searchParams.get('token')
		if (connToken !== this.token) {
			ws.close(4001, 'Unauthorized')
			return
		}

		if (this.#hub && this.#hub.readyState === 1) {
			ws.close(4000, 'Another hub is already connected')
			return
		}

		this.#hub = ws
		console.error('[supa-agent-mcp] Hub connected')

		ws.on('message', (/** @type {Buffer} */ rawData) => {
			/** @type {{ type: string, success?: boolean, data?: string, message?: string, version?: string }} */
			let msg
			try {
				msg = JSON.parse(rawData.toString('utf-8'))
			} catch {
				return
			}

			if (msg.type === 'ready') {
				const clientVersion = msg.version
				const clientMajor = clientVersion ? clientVersion.split('.')[0] : ''
				const serverMajor = PKG_VERSION.split('.')[0]
				if (!clientVersion || clientMajor !== serverMajor) {
					console.error(
						`[supa-agent-mcp] Version mismatch: client is v${clientVersion || 'unknown'}, server is v${PKG_VERSION}`
					)
					ws.send(
						JSON.stringify({
							type: 'error',
							message: `Version mismatch: client version ${clientVersion || 'unknown'} is not compatible with server version ${PKG_VERSION}.`,
						})
					)
					ws.close(4002, 'Version mismatch')
					return
				}
				console.error(`[supa-agent-mcp] Handshake successful: client is v${clientVersion}`)
			} else if (msg.type === 'result') {
				this.#pendingTask?.resolve({ success: msg.success ?? false, data: msg.data ?? '' })
				this.#pendingTask = null
			} else if (msg.type === 'error') {
				this.#pendingTask?.reject(new Error(msg.message ?? 'Unknown error from hub'))
				this.#pendingTask = null
			}
		})

		ws.on('close', () => {
			console.error('[supa-agent-mcp] Hub disconnected')
			if (this.#hub === ws) this.#hub = null
			if (this.#pendingTask) {
				this.#pendingTask.reject(new Error('Hub disconnected while task was running'))
				this.#pendingTask = null
			}
		})
	}
}
