#!/usr/bin/env node
/**
 * Guard against accidental `npm publish` from a deploy or CI job.
 *
 * The repo is source-first and the publish pipeline is intentionally manual:
 * packages have `prepublishOnly` rewrites that swap `package.json` exports to
 * `dist/` and copy LICENSE/README. Publishing the wrong build, or letting a
 * stale CI job ship a regression, would be costly to roll back.
 *
 * To publish, set SUPA_AGENT_PUBLISH_CONFIRM=1 in the same shell as the
 * `npm publish` (or `npm publish -w <pkg>`) command. Any other invocation —
 * including a stray `npm publish` from a deploy script or a default CI step —
 * is aborted with a non-zero exit so npm refuses to upload anything.
 */
const expectedFlag = 'SUPA_AGENT_PUBLISH_CONFIRM'

if (process.env[expectedFlag] === '1') {
	process.exit(0)
}

console.error('')
console.error('  ✖ Refusing to publish.')
console.error('')
console.error('    This repo publishes manually and requires an explicit confirmation')
console.error('    flag so a deploy script or CI job cannot accidentally ship a build.')
console.error('')
console.error('    To publish intentionally, run:')
console.error('')
console.error(`      ${expectedFlag}=1 npm publish`)
console.error(`      ${expectedFlag}=1 npm publish -w supa-agent`)
console.error(`      ${expectedFlag}=1 npm publish -w @supa-agent/core`)
console.error('')
console.error('    See scripts/publish-guard.js for the policy.')
console.error('')
process.exit(1)
