#!/usr/bin/env node
/**
 * Run Plan24 / DDS demo seed scripts against linked Supabase.
 * Sets statement_timeout in each SQL file; runs scripts sequentially.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_REF = 'uhwbvwlneenvkldccehq'

const SQL_FILES = [
  'scripts/seed-plan24-today-demo.sql',
  'scripts/seed-dds-toploss-reward-per-cell.sql',
  'scripts/complete-plan24-checks-next-7-days.sql',
]

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

const dbPassword = process.env.SUPABASE_DB_PASSWORD?.trim()
if (!dbPassword) {
  console.error('Need SUPABASE_DB_PASSWORD (.env.supabase or shell env).')
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

for (const rel of SQL_FILES) {
  const abs = join(ROOT, rel)
  if (!existsSync(abs)) {
    console.error(`Missing ${rel}`)
    process.exit(1)
  }
  console.log(`\n>>> ${rel}`)
  runSupabase(['db', 'query', '--linked', '--yes', '-f', rel])
}

console.log('\nOK: demo seeds complete.')
