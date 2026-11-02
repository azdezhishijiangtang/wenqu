import { build } from 'esbuild'
import { mkdir } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const out = resolve(here, 'dist/worker.js')

await mkdir(dirname(out), { recursive: true })
await build({
  entryPoints: [resolve(here, 'src/index.ts')],
  outfile: out,
  bundle: true,
  format: 'esm',
  target: 'es2022',
  platform: 'neutral',
  legalComments: 'none',
  minify: false,
  banner: {
    js: '// 问渠识图服务 · 单文件版，可直接粘贴到 Cloudflare 控制台的 Worker 编辑器。\n// 需要在 Settings → Bindings 里绑定 AI（变量名 AI）和 D1（变量名 DB），并设置 AUTH_SECRET。',
  },
})
console.log(`已生成 ${out}`)
