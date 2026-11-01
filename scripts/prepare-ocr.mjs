import { copyFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const root = new URL('../', import.meta.url)
const dest = new URL('public/ocr/', root)
await mkdir(dest, { recursive: true })
const assets = [
  ['tesseract.js/dist/worker.min.js', 'worker.min.js'],
  ...['tesseract-core-lstm.wasm.js', 'tesseract-core-simd-lstm.wasm.js'].map(name => [`tesseract.js-core/${name}`, name]),
  ...['chi_sim', 'eng'].map(lang => [`@tesseract.js-data/${lang}/4.0.0_best_int/${lang}.traineddata.gz`, `${lang}.traineddata.gz`]),
]
for (const [source, target] of assets) {
  await copyFile(new URL(`node_modules/${source}`, root), new URL(target, dest))
}
console.log(`Prepared ${assets.length} local OCR assets in ${fileURLToPath(dest)}`)
