import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(dir, '..')

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Merge repo-root `.env*` with `web/.env*` so local dev matches prod when vars live at repo root
  // (Vite’s default envDir is `web/` only). `web/` wins on duplicate keys.
  const merged = { ...loadEnv(mode, repoRoot, ''), ...loadEnv(mode, dir, '') }
  const mergedUrl = merged.VITE_SUPABASE_URL ?? ''
  const mergedAnon = merged.VITE_SUPABASE_ANON_KEY ?? ''
  const target = mergedUrl.trim().replace(/\/$/, '')
  const anon = mergedAnon.trim()

  /** Only pin keys when set from files; otherwise Vite keeps default `process.env` injection (CI/Vercel). */
  const envDefine: Record<string, string> = {}
  if (mergedUrl) envDefine['import.meta.env.VITE_SUPABASE_URL'] = JSON.stringify(mergedUrl)
  if (mergedAnon) envDefine['import.meta.env.VITE_SUPABASE_ANON_KEY'] = JSON.stringify(mergedAnon)

  /** Dev/preview: same-origin `/api/report-advisor` → Supabase Edge Function (adds apikey server-side). */
  const advisorProxy =
    target && anon
      ? {
          '/api/report-advisor': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/matrix-report-advisor',
            // http-proxy; types vary by Vite version
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
          '/api/ux-ui-expert': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/ux-ui-expert',
            // http-proxy; types vary by Vite version
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
          '/api/road-map-builder': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/road-map-builder',
            // http-proxy; types vary by Vite version
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
          '/api/apps-team': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/apps-team',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
          '/api/pdca-cbn-image': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/pdca-cbn-image',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
          '/api/bms-brain-ai': {
            target,
            changeOrigin: true,
            secure: true,
            rewrite: () => '/functions/v1/bms-brain-ai',
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            configure: (proxy: any) => {
              proxy.on('proxyReq', (proxyReq: { setHeader: (k: string, v: string) => void }) => {
                proxyReq.setHeader('apikey', anon)
              })
            },
          },
        }
      : undefined

  return {
    plugins: [react(), tailwindcss()],
    ...(Object.keys(envDefine).length ? { define: envDefine } : {}),
    server: advisorProxy ? { proxy: advisorProxy } : {},
    preview: advisorProxy ? { proxy: advisorProxy } : {},
  }
})
