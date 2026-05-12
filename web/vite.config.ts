import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const dir = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, dir, '')
  const target = env.VITE_SUPABASE_URL?.trim().replace(/\/$/, '')
  const anon = env.VITE_SUPABASE_ANON_KEY?.trim()

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
        }
      : undefined

  return {
    plugins: [react(), tailwindcss()],
    server: advisorProxy ? { proxy: advisorProxy } : {},
    preview: advisorProxy ? { proxy: advisorProxy } : {},
  }
})
