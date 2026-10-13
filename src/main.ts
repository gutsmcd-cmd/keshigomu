import './style.css'
import { dict, type Dict, type Lang } from './i18n'

const MAX = 2560 // longest side kept in memory
const SZ = 512 // LaMa input size
let lang: Lang = (localStorage.getItem('keshigomu-lang') as Lang) || 'ja'
let t: Dict = dict[lang]
navigator.storage?.persist?.().catch(() => {})

const app = document.getElementById('app')!
const img = document.createElement('canvas') // current photo
const view = document.createElement('canvas') // what the user sees (photo + red brush)
const mask = document.createElement('canvas') // brush strokes (alpha)
view.className = 'stage'
let hasPhoto = false
let brush = 40 // in screen px
let undoStack: ImageData[] = []
let redoStack: ImageData[] = []
let busy = false
let original: ImageData | null = null
let showOrig = false
let worker: Worker | null = null

const $ = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = ''): HTMLElementTagNameMap[K] => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e
}
const button = (cls: string, text: string, fn: () => void) => { const b = $('button', cls, text); b.onclick = fn; return b }
function toast(msg: string) { const d = $('div', 'toast', msg); document.body.append(d); setTimeout(() => d.remove(), 2200) }

const status = $('div', 'status'); status.hidden = true
const stText = $('div'); const stBar = $('progress'); const stNote = $('div', 'small')
status.append(stText, stBar, stNote)
function setStatus(text: string | null, p?: number, note = '') {
  status.hidden = text === null; if (text === null) return
  stText.textContent = text; stNote.textContent = note
  if (p === undefined) stBar.removeAttribute('value'); else stBar.value = p
}

function draw() {
  const c = view.getContext('2d')!
  c.globalCompositeOperation = 'source-over'
  if (showOrig && original) c.putImageData(original, 0, 0)
  else { c.drawImage(img, 0, 0); c.globalAlpha = 0.55; c.drawImage(mask, 0, 0); c.globalAlpha = 1 }
}
function snapshot() { return img.getContext('2d')!.getImageData(0, 0, img.width, img.height) }

function render() {
  document.documentElement.lang = lang
  app.replaceChildren()
  const top = $('div', 'top')
  top.append($('h1', '', t.app), button('ghost', t.toggle, () => { lang = lang === 'ja' ? 'en' : 'ja'; localStorage.setItem('keshigomu-lang', lang); t = dict[lang]; render() }))
  app.append(top, $('p', 'lead', t.lead))
  const file = $('input'); file.type = 'file'; file.accept = 'image/*'; file.hidden = true
  file.onchange = () => { const f = file.files?.[0]; if (f) void openPhoto(f); file.value = '' }
  app.append(file)
  if (!hasPhoto) {
    const home = $('div', 'home')
    home.append(button('primary big', '📷 ' + t.pick, () => file.click()), $('p', 'note', '🙏 ' + t.note), $('p', 'small', t.hint))
    app.append(home, $('p', 'foot', t.foot))
    return
  }
  const bar = $('div', 'ebar')
  const ub = button('', '↶ ' + t.undo, undo); ub.disabled = !undoStack.length || busy
  const rb = button('', '↷ ' + t.redo, redo); rb.disabled = !redoStack.length || busy
  const cmp = button('', t.compare, () => {})
  const hold = (on: boolean) => { showOrig = on; draw() }
  cmp.onpointerdown = () => hold(true); cmp.onpointerup = cmp.onpointerleave = cmp.onpointercancel = () => hold(false)
  bar.append(button('ghost', '← ' + t.other, () => file.click()), ub, rb, cmp)
  const wrap = $('div', 'stagewrap'); wrap.append(view, status)
  const tools = $('div', 'tools')
  const sl = $('label', 'sl'); const range = $('input'); range.type = 'range'; range.min = '8'; range.max = '120'; range.value = String(brush)
  range.oninput = () => { brush = Number(range.value) }
  sl.append($('span', '', t.brush), range)
  const eb = button('primary', '✨ ' + t.erase, () => void erase()); eb.disabled = busy
  tools.append(sl, button('', t.clearMask, () => { clearMask(); draw() }), eb,
    button('', '💾 ' + t.save, () => void save(false)))
  if ('share' in navigator) tools.append(button('', t.share, () => void save(true)))
  app.append(bar, wrap, tools, $('p', 'small tip', t.hint), $('p', 'foot', '🙏 ' + t.note + ' ' + t.foot))
}

function clearMask() { mask.getContext('2d')!.clearRect(0, 0, mask.width, mask.height) }

async function openPhoto(f: File) {
  const bmp = await createImageBitmap(f, { imageOrientation: 'from-image' } as ImageBitmapOptions)
  const s = Math.min(1, MAX / Math.max(bmp.width, bmp.height))
  const w = Math.round(bmp.width * s), h = Math.round(bmp.height * s)
  for (const c of [img, view, mask]) { c.width = w; c.height = h }
  img.getContext('2d')!.drawImage(bmp, 0, 0, w, h)
  original = snapshot(); undoStack = []; redoStack = []; hasPhoto = true
  render(); draw()
}

// --- brushing ---
let last: { x: number; y: number } | null = null
const pts = new Map<number, true>()
function toImg(e: PointerEvent) { const r = view.getBoundingClientRect(); return { x: (e.clientX - r.left) * view.width / r.width, y: (e.clientY - r.top) * view.height / r.height, k: view.width / r.width } }
function stroke(e: PointerEvent) {
  const p = toImg(e); const c = mask.getContext('2d')!
  c.strokeStyle = c.fillStyle = '#ff2d55'; c.lineCap = c.lineJoin = 'round'; c.lineWidth = brush * p.k
  c.beginPath(); if (last) { c.moveTo(last.x, last.y); c.lineTo(p.x, p.y); c.stroke() } else { c.arc(p.x, p.y, brush * p.k / 2, 0, Math.PI * 2); c.fill() }
  last = p; draw()
}
view.addEventListener('pointerdown', (e) => { if (busy) return; pts.set(e.pointerId, true); if (pts.size > 1) return; view.setPointerCapture(e.pointerId); last = null; stroke(e) })
view.addEventListener('pointermove', (e) => { if (pts.size === 1 && pts.has(e.pointerId) && !busy) stroke(e) })
const up = (e: PointerEvent) => { pts.delete(e.pointerId); last = null }
view.addEventListener('pointerup', up); view.addEventListener('pointercancel', up)

// --- inpainting ---
function getWorker() {
  if (!worker) worker = new Worker(new URL('./worker.ts', import.meta.url), { type: 'module' })
  return worker
}
function run(rgba: Uint8ClampedArray, m: Uint8ClampedArray): Promise<Uint8ClampedArray> {
  return new Promise((resolve, reject) => {
    const w = getWorker()
    w.onmessage = (e) => {
      const d = e.data
      if (d.type === 'progress') setStatus(t.dl, d.got / d.total, `${Math.round(d.got / 1048576)} / ${Math.round(d.total / 1048576)} MB · ${t.dlNote}`)
      else if (d.type === 'loading') setStatus(t.loading)
      else if (d.type === 'working') setStatus(t.working)
      else if (d.type === 'done') resolve(d.rgba)
      else if (d.type === 'error') reject(new Error(d.msg))
    }
    w.postMessage({ type: 'run', rgba, mask: m }, [rgba.buffer, m.buffer])
  })
}

function maskBox() {
  const d = mask.getContext('2d')!.getImageData(0, 0, mask.width, mask.height).data
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1
  for (let y = 0; y < mask.height; y++) for (let x = 0; x < mask.width; x++) if (d[(y * mask.width + x) * 4 + 3] > 20) {
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
  }
  return x1 < 0 ? null : { x0, y0, x1, y1 }
}

async function erase() {
  if (busy) return
  const b = maskBox(); if (!b) { toast(t.noMask); return }
  const W = img.width, H = img.height
  // square crop around the strokes with plenty of context, at least 512 px when the photo allows
  const bw = b.x1 - b.x0 + 1, bh = b.y1 - b.y0 + 1
  let side = Math.max(bw, bh) * 2.2
  side = Math.min(Math.max(side, Math.min(SZ, W, H), 64), Math.max(W, H))
  const sw = Math.min(side, W), sh = Math.min(side, H)
  const cx = (b.x0 + b.x1) / 2, cy = (b.y0 + b.y1) / 2
  const sx = Math.round(Math.min(Math.max(cx - sw / 2, 0), W - sw)), sy = Math.round(Math.min(Math.max(cy - sh / 2, 0), H - sh))
  const cw = Math.round(sw), ch = Math.round(sh)
  const a = new OffscreenCanvas(SZ, SZ).getContext('2d', { willReadFrequently: true })!
  a.imageSmoothingQuality = 'high'
  a.drawImage(img, sx, sy, cw, ch, 0, 0, SZ, SZ)
  const rgba = a.getImageData(0, 0, SZ, SZ).data
  const mc = new OffscreenCanvas(SZ, SZ).getContext('2d')!
  mc.filter = 'blur(2px)'; mc.drawImage(mask, sx, sy, cw, ch, 0, 0, SZ, SZ) // slight grow
  const m = mc.getImageData(0, 0, SZ, SZ).data
  busy = true; render(); draw(); setStatus(t.loading)
  try {
    const out = await run(new Uint8ClampedArray(rgba), new Uint8ClampedArray(m))
    undoStack.push(snapshot()); if (undoStack.length > 20) undoStack.shift(); redoStack = []
    const oc = new OffscreenCanvas(SZ, SZ); oc.getContext('2d')!.putImageData(new ImageData(new Uint8ClampedArray(out), SZ, SZ), 0, 0)
    // paste back only where brushed, with a soft edge
    const patch = new OffscreenCanvas(cw, ch); const p = patch.getContext('2d')!
    p.imageSmoothingQuality = 'high'; p.drawImage(oc, 0, 0, cw, ch)
    const feather = new OffscreenCanvas(cw, ch); const f = feather.getContext('2d')!
    const r = Math.max(2, cw / SZ * 3)
    f.filter = `blur(${r}px)`; f.drawImage(mask, sx, sy, cw, ch, 0, 0, cw, ch); f.filter = 'none'
    f.drawImage(mask, sx, sy, cw, ch, 0, 0, cw, ch)
    p.globalCompositeOperation = 'destination-in'; p.drawImage(feather, 0, 0)
    img.getContext('2d')!.drawImage(patch, sx, sy)
    clearMask()
  } catch (err) {
    console.error(err); toast(t.fail)
  } finally {
    busy = false; setStatus(null); render(); draw()
  }
}

function undo() { const s = undoStack.pop(); if (!s) return; redoStack.push(snapshot()); img.getContext('2d')!.putImageData(s, 0, 0); render(); draw() }
function redo() { const s = redoStack.pop(); if (!s) return; undoStack.push(snapshot()); img.getContext('2d')!.putImageData(s, 0, 0); render(); draw() }

async function save(share: boolean) {
  const blob: Blob = await new Promise((r) => img.toBlob((b) => r(b!), 'image/jpeg', 0.95))
  const name = `keshigomu-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.jpg`
  const file = new File([blob], name, { type: 'image/jpeg' })
  if (share && navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file] }).catch(() => {}); return }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 4000); toast(t.saved)
}

render()
