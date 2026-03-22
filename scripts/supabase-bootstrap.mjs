#!/usr/bin/env node
/**
 * One-shot Supabase setup (remote project `uhwbvwlneenvkldccehq`).
 *
 * 1) Auth URLs (localhost) — needs Personal Access Token only:
 *    export SUPABASE_ACCESS_TOKEN="..."   # Dashboard → Account → Access Tokens
 *
 * 2) Apply SQL migration — needs token + database password:
 *    export SUPABASE_DB_PASSWORD="..."    # Project Settings → Database
 *
 * 3) Promote admin (after you registered in the app):
 *    npm run supabase:bootstrap:promote
 *    Optional: BOOTSTRAP_ADMIN_EMAIL=you@example.com
 *
 * Or put secrets in repo-root `.env.supabase` (gitignored) — see `.env.supabase.example`.
 */

import { spawnSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')
const PROJECT_REF = 'uhwbvwlneenvkldccehq'
const API = 'https://api.supabase.com/v1'

/** Load KEY=value lines into process.env if not already set (no dependency on dotenv). */
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
const promoteOnly = process.argv.includes('--promote-admin')
const adminEmail =
  process.env.BOOTSTRAP_ADMIN_EMAIL?.trim() || 'x7petk@gmail.com'

function run(cmd, args, opts = {}) {
  const r = spawnSync(cmd, args, {
    cwd: ROOT,
    stdio: opts.input != null ? ['pipe', 'inherit', 'inherit'] : ['inherit', 'inherit', 'inherit'],
    env: process.env,
    input: opts.input,
    encoding: opts.input != null ? 'utf8' : undefined,
  })
  if (r.status !== 0) {
    process.exit(r.status ?? 1)
  }
}

function runSupabase(args) {
  const localCli = join(ROOT, 'node_modules/supabase/bin/supabase')
  if (existsSync(localCli)) {
    run(localCli, args)
  } else {
    run('npx', ['--yes', 'supabase@latest', ...args])
  }
}

async function patchAuthUrls() {
  const res = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const body = await res.text()
  if (!res.ok) {
    throw new Error(`GET /config/auth failed ${res.status}: ${body}`)
  }
  const current = JSON.parse(body)
  const allow = new Set()
  for (const line of String(current.uri_allow_list || '')
    .split(/[\n,]+/)
    .map((s) => s.trim())
    .filter(Boolean)) {
    allow.add(line)
  }
  allow.add('http://localhost:5173')
  allow.add('http://127.0.0.1:5173')

  const patch = await fetch(`${API}/projects/${PROJECT_REF}/config/auth`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      site_url: 'http://localhost:5173',
      uri_allow_list: [...allow].join('\n'),
    }),
  })
  const patchBody = await patch.text()
  if (!patch.ok) {
    throw new Error(`PATCH /config/auth failed ${patch.status}: ${patchBody}`)
  }
  console.log('OK: Auth URL configuration (site_url + redirect allow list for localhost:5173).')
}

function linkProject() {
  runSupabase(['link', '--project-ref', PROJECT_REF, '-p', dbPassword, '--yes'])
  console.log('OK: Linked CLI to remote project.')
}

function applyMigrations() {
  runSupabase(['db', 'push', '--linked', '--yes'])
  console.log('OK: Pushed pending Supabase migrations to remote.')
}

function promoteAdminSql() {
  const safe = adminEmail.replace(/'/g, "''")
  const sql = `update public.profiles set role = 'admin' where id = (select id from auth.users where email = '${safe}' limit 1);`
  runSupabase(['db', 'query', '--linked', sql, '-o', 'table'])
  console.log(`OK: Ran admin promotion for ${adminEmail} (0 rows if user does not exist yet).`)
}

async function main() {
  if (!token) {
    console.error(
      'Missing SUPABASE_ACCESS_TOKEN.\n' +
        'Create a token: Supabase Dashboard → Account → Access Tokens.\n' +
        'Then either:\n' +
        '  export SUPABASE_ACCESS_TOKEN="sbp_..."\n' +
        'or copy `.env.supabase.example` → `.env.supabase` in the repo root and fill it in.',
    )
    process.exit(1)
  }

  if (promoteOnly) {
    if (!dbPassword) {
      console.error(
        'Missing SUPABASE_DB_PASSWORD (needed for `supabase link` / `db query --linked`).',
      )
      process.exit(1)
    }
    linkProject()
    promoteAdminSql()
    return
  }

  await patchAuthUrls()

  if (!dbPassword) {
    console.log(
      '\nSkip: SQL migration (set SUPABASE_DB_PASSWORD to run `supabase link` + apply migration).\n',
    )
    return
  }

  linkProject()
  applyMigrations()
  console.log(
    `\nNext: register at http://localhost:5173, then run:\n  npm run supabase:bootstrap:promote\n(with same SUPABASE_ACCESS_TOKEN and SUPABASE_DB_PASSWORD in env)\n`,
  )
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
