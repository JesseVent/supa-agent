import type { HistoricalEvent } from '@supa-agent/core'
import { type DBSchema, type IDBPDatabase, openDB } from 'idb'

const DB_NAME = 'supa-agent'
const DB_VERSION = 2

export interface SessionRecord {
	id: string
	task: string
	history: HistoricalEvent[]
	status: 'completed' | 'error'
	createdAt: number
	/** Non-sensitive config snapshot at the time the session ran */
	configSnapshot?: {
		model: string
		baseURL: string
		projectRef?: string
		projectName?: string
		language?: string
	}
}

export interface LogEntry {
	id: string
	timestamp: number
	level: 'info' | 'success' | 'warn' | 'error'
	source: 'mcp' | 'agent' | 'config'
	message: string
	/** Optional structured detail (task text, error string, etc.) */
	detail?: string
}

interface PageAgentDB extends DBSchema {
	sessions: {
		key: string
		value: SessionRecord
		indexes: { 'by-created': number }
	}
	logs: {
		key: string
		value: LogEntry
		indexes: { 'by-timestamp': number }
	}
}

let dbPromise: Promise<IDBPDatabase<PageAgentDB>> | null = null

function getDB() {
	if (!dbPromise) {
		dbPromise = openDB<PageAgentDB>(DB_NAME, DB_VERSION, {
			upgrade(db, oldVersion) {
				if (oldVersion < 1) {
					const sessions = db.createObjectStore('sessions', { keyPath: 'id' })
					sessions.createIndex('by-created', 'createdAt')
				}
				if (oldVersion < 2) {
					const logs = db.createObjectStore('logs', { keyPath: 'id' })
					logs.createIndex('by-timestamp', 'timestamp')
				}
			},
		})
	}
	return dbPromise
}

export async function saveSession(
	session: Omit<SessionRecord, 'id' | 'createdAt'>
): Promise<SessionRecord> {
	const db = await getDB()
	const record: SessionRecord = {
		...session,
		id: crypto.randomUUID(),
		createdAt: Date.now(),
	}
	await db.put('sessions', record)
	return record
}

export interface SessionInput {
	task: string
	history: HistoricalEvent[]
	status: 'completed' | 'error'
	configSnapshot?: SessionRecord['configSnapshot']
}

/** List sessions, newest first */
export async function listSessions(): Promise<SessionRecord[]> {
	const db = await getDB()
	const all = await db.getAllFromIndex('sessions', 'by-created')
	return all.reverse()
}

export async function getSession(id: string): Promise<SessionRecord | undefined> {
	const db = await getDB()
	return db.get('sessions', id)
}

export async function deleteSession(id: string): Promise<void> {
	const db = await getDB()
	await db.delete('sessions', id)
}

export async function clearSessions(): Promise<void> {
	const db = await getDB()
	await db.clear('sessions')
}

/** Write a structured log entry. Fire-and-forget safe. */
export async function writeLog(entry: Omit<LogEntry, 'id' | 'timestamp'>): Promise<void> {
	try {
		const db = await getDB()
		await db.put('logs', {
			...entry,
			id: crypto.randomUUID(),
			timestamp: Date.now(),
		})
	} catch {
		// Never let logging crash the agent
	}
}

const LOG_LIMIT = 500

/** List log entries, newest first (capped at LOG_LIMIT) */
export async function listLogs(): Promise<LogEntry[]> {
	const db = await getDB()
	const all = await db.getAllFromIndex('logs', 'by-timestamp')
	return all.reverse().slice(0, LOG_LIMIT)
}

export async function clearLogs(): Promise<void> {
	const db = await getDB()
	await db.clear('logs')
}
