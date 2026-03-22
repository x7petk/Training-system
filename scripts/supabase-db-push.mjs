#!/usr/bin/env node
/**
 * Link (if needed) and push all migrations in supabase/migrations to the linked remote.
 * Loads repo-root `.env.supabase` the same way as supabase-bootstrap.mjs.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_REF = 'uhwbvwlneenvkldccehq'

function loadOptionalEnvFile(absPath) {
  if (!existsSync(absPath)) return
  const text = readFileSync(absPath, 'utf8')
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq <= 0) continue
    const key = trimmed.slice(0, eq).trim()
    let val = trimmed.slice(eq + 1).trim()
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1)
    }
    if (process.env[key] === undefined || process.env[key] === '') {
      process.env[key] = val
    }
  }
}

loadOptionalEnvFile(join(ROOT, '.env.supabase'))

const token = process.env.SUPABASE_ACCESS_TOKEN?.trim()
const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()

if (!token || !dbPassword) {
  console.error(
    'Need SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD (.env.supabase or shell env).',
  )
  process.exit(1)
}

function run(cmd, args) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: 'inherit',
    env: process.env,
  })
  if (r.status !== 0) process.exit(r.status ?? 1)
}

function runSupabase(args) {
  const localCli = join(ROOT, 'node_modules/supabase/bin/supabase')
  if (existsSync(localCli)) {
    run(localCli, args)
  } else {
    run('npx', ['--yes', 'supabase@latest', ...args])
  }
}

runSupabase(['link', '--project-ref', PROJECT_REF, '-p', dbPassword, '--yes'])
runSupabase(['db', 'push', '--linked', '--yes'])
console.log('OK: db push complete.')
