// Copia os arquivos WASM do MediaPipe para public/ e baixa o modelo Face Landmarker.
// Roda antes de `dev` e `build` (inclusive no Workers Builds). Tudo servido do próprio domínio (§3.5).
import { copyFile, mkdir, readdir, stat, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

const root = new URL('..', import.meta.url).pathname
const src = join(root, 'node_modules/@mediapipe/tasks-vision/wasm')
const dest = join(root, 'public/mediapipe/wasm')
const modelPath = join(root, 'public/mediapipe/face_landmarker.task')
const MODEL_URL = 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

await mkdir(dest, { recursive: true })
for (const f of await readdir(src)) {
  if (f.startsWith('vision_wasm_internal') || f.startsWith('vision_wasm_nosimd_internal')) await copyFile(join(src, f), join(dest, f))
}
console.log('[mediapipe] wasm copiado para public/mediapipe/wasm')

if (existsSync(modelPath) && (await stat(modelPath)).size > 1_000_000) {
  console.log('[mediapipe] modelo já presente')
} else {
  try {
    const res = await fetch(MODEL_URL, { signal: AbortSignal.timeout(60_000) })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    await writeFile(modelPath, Buffer.from(await res.arrayBuffer()))
    console.log('[mediapipe] modelo baixado')
  } catch (e) {
    console.warn(`[mediapipe] AVISO: não foi possível baixar o modelo (${e.message}).`)
    console.warn('[mediapipe] O app usa o modelo do CDN do Google como alternativa; se falhar, a captura cai no modo simples (sinal "prova de vida indisponível").')
  }
}
