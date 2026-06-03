import matter from 'gray-matter'
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { basename, join } from 'node:path'
import OpenAI from 'openai'
import pg from 'pg'

import type { ParsedChunk } from './types.js'

interface Config {
	skill: string
	skillsDir: string
	directUrl: string
	openaiKey: string
}

function getConfig(): Config {
	const args = process.argv.slice(2)
	const flag = (name: string, env: string) => {
		const i = args.indexOf(name)
		return (i !== -1 ? args[i + 1] : undefined) ?? process.env[env]
	}

	const skill = flag('--skill', 'SKILL_NAME')
	const skillsDir = flag('--skills-dir', 'SKILLS_DIR') ?? '.agents/skills'
	const directUrl = flag('--db-url', 'DIRECT_URL')
	const openaiKey = flag('--openai-key', 'OPENAI_API_KEY')

	if (!skill) throw new Error('--skill or SKILL_NAME env var required')
	if (!directUrl) throw new Error('--db-url or DIRECT_URL env var required')
	if (!openaiKey) throw new Error('--openai-key or OPENAI_API_KEY env var required')

	return { skill, skillsDir, directUrl, openaiKey }
}

function parseChunks(skillsDir: string, skillName: string): ParsedChunk[] {
	const refsPath = join(skillsDir, skillName, 'references')
	const files = readdirSync(refsPath).filter((f) => f.endsWith('.md') && !f.startsWith('_'))

	return files.map((filename) => {
		const raw = readFileSync(join(refsPath, filename), 'utf-8')
		const { data, content } = matter(raw)
		const id = basename(filename, '.md')
		const category = id.split('-')[0]
		const body = content.trim()

		const tags: string[] = Array.isArray(data.tags)
			? data.tags
			: typeof data.tags === 'string'
				? data.tags
						.split(',')
						.map((t: string) => t.trim())
						.filter(Boolean)
				: []

		return {
			id,
			skill_name: skillName,
			title: (data.title as string) ?? id,
			impact: (data.impact as ParsedChunk['impact']) ?? 'MEDIUM',
			impact_description: (data.impactDescription as string) ?? null,
			tags,
			category,
			content: body,
			content_hash: createHash('sha256').update(body).digest('hex'),
		}
	})
}

async function main() {
	const config = getConfig()
	const pool = new pg.Pool({ connectionString: config.directUrl })
	const openai = new OpenAI({ apiKey: config.openaiKey })

	try {
		const chunks = parseChunks(config.skillsDir, config.skill)
		console.log(`Found ${chunks.length} reference files for skill: ${config.skill}`)

		// Fetch existing content hashes for incremental ingestion
		const { rows: existing } = await pool.query<{ id: string; content_hash: string }>(
			'SELECT id, content_hash FROM evals.skill_chunks WHERE skill_name = $1',
			[config.skill]
		)
		const existingMap = new Map(existing.map((r) => [r.id, r.content_hash]))

		const toEmbed = chunks.filter((c) => existingMap.get(c.id) !== c.content_hash)
		console.log(`${toEmbed.length} to embed, ${chunks.length - toEmbed.length} unchanged`)

		if (toEmbed.length === 0) {
			console.log('Nothing to do.')
			return
		}

		// Embed in batches of 10 (API limit awareness)
		const batchSize = 10
		let done = 0

		for (let i = 0; i < toEmbed.length; i += batchSize) {
			const batch = toEmbed.slice(i, i + batchSize)
			// Prepend title so prompt similarity matches title intent, not just SQL tokens
			const inputs = batch.map((c) => `${c.title}\n\n${c.content}`)

			const response = await openai.embeddings.create({
				model: 'text-embedding-3-small',
				input: inputs,
			})

			for (let j = 0; j < batch.length; j++) {
				const chunk = batch[j]
				const embedding = response.data[j].embedding
				const vectorStr = `[${embedding.join(',')}]`

				await pool.query(
					`INSERT INTO evals.skill_chunks
             (id, skill_name, title, impact, impact_description, tags, category,
              content, embedding, content_hash, updated_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::vector, $10, now())
           ON CONFLICT (id) DO UPDATE SET
             title              = EXCLUDED.title,
             impact             = EXCLUDED.impact,
             impact_description = EXCLUDED.impact_description,
             tags               = EXCLUDED.tags,
             category           = EXCLUDED.category,
             content            = EXCLUDED.content,
             embedding          = EXCLUDED.embedding,
             content_hash       = EXCLUDED.content_hash,
             updated_at         = now()`,
					[
						chunk.id,
						chunk.skill_name,
						chunk.title,
						chunk.impact,
						chunk.impact_description,
						chunk.tags,
						chunk.category,
						chunk.content,
						vectorStr,
						chunk.content_hash,
					]
				)

				done++
				process.stdout.write(`\r  [${done}/${toEmbed.length}] ${chunk.id}`)
			}
		}

		console.log(`\nDone. ${done} chunks upserted.`)
	} finally {
		await pool.end()
	}
}

main().catch((err) => {
	console.error('\nIngest failed:', err.message)
	process.exit(1)
})
