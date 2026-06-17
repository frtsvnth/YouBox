import express from 'express'
import { spawn, execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import http from 'node:http'
import net from 'node:net'

const PORT = parseInt(process.env.PORT || '3808', 10)
const PROFILE_DIR = process.env.PROFILE_DIR || '/browser-profile'
const BROWSER_PORT = parseInt(process.env.BROWSER_PORT || '3809', 10)

fs.mkdirSync(PROFILE_DIR, { recursive: true })

let browserProcess = null
let browserRunning = false
let browserError = null

function cdpFetch(path) {
  return new Promise((resolve) => {
    http.get(`http://127.0.0.1:${BROWSER_PORT}${path}`, (res) => {
      let data = ''
      res.on('data', c => data += c)
      res.on('end', () => resolve(data))
    }).on('error', () => resolve(null))
  })
}

function startBrowser() {
  return new Promise(async (resolve) => {
    try {
      try {
        execSync('pkill -f "chromium.*remote-debugging" 2>/dev/null || true')
        await new Promise(r => setTimeout(r, 1000))
      } catch {}
      try {
        for (const f of ['Chromium', 'SingletonLock', 'SingletonSocket', 'SingletonCookie']) {
          const p = path.join(PROFILE_DIR, f)
          if (fs.existsSync(p)) fs.unlinkSync(p)
        }
      } catch {}
      const browserArgs = [
        '--headless=new',
        `--remote-debugging-port=${BROWSER_PORT}`,
        '--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage',
        '--disable-gpu', '--no-first-run',
        '--window-size=1280,720',
        `--user-data-dir=${PROFILE_DIR}`,
      ].join(' ')
      console.log('[browser] launching:', browserArgs.slice(0, 120) + '...')
      browserProcess = spawn('/bin/sh', ['-c',
        'nohup /usr/lib/chromium/chromium ' + browserArgs + ' </dev/null >/tmp/chrome.log 2>&1 &'
      ], { stdio: 'ignore', env: { ...process.env, HOME: '/home/youbox' }, detached: true })

      browserProcess.on('exit', (code) => {
        console.log('[browser] shell exited:', code)
      })

      console.log('[browser] waiting for CDP (30s max)...')
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1000))
        const ver = await cdpFetch('/json/version')
        if (ver) {
          browserRunning = true
          browserError = null
          console.log('[browser] started, CDP on', BROWSER_PORT)
          resolve(true)
          return
        }
      }

      browserError = 'Chromium failed to start (CDP not responding)'
      console.error('[browser]', browserError)
      resolve(false)
    } catch (err) {
      browserError = err.message
      resolve(false)
    }
  })
}

function cdpNavigate(url) {
  return new Promise((resolve) => {
    import('playwright-core').then(({ chromium }) => {
      chromium.connectOverCDP(`http://127.0.0.1:${BROWSER_PORT}`).then(async (browser) => {
        const ctx = browser.contexts()[0]
        const pages = ctx ? ctx.pages() : []
        const page = pages.length > 0 ? pages[0] : await ctx.newPage()
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {})
        await browser.close()
        resolve()
      }).catch(() => resolve())
    }).catch(() => resolve())
  })
}

const app = express()
app.use(express.json())

const LANDING = `<!DOCTYPE html>
<html lang="ru"><head><meta charset="UTF-8"><title>YouBox Browser</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<style>*{box-sizing:border-box;margin:0;padding:0}
body{font-family:system-ui,sans-serif;background:#09090b;color:#fafafa;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:20px}
.card{background:#18181b;border:1px solid #27272a;border-radius:12px;padding:32px;max-width:520px;width:100%}
h1{font-size:18px;font-weight:600;margin-bottom:4px}.sub{color:#71717a;font-size:13px;margin-bottom:24px}
.stat{display:flex;align-items:center;gap:6px;font-size:13px;margin-bottom:16px;color:#a1a1aa}
.dot{width:8px;height:8px;border-radius:50%;display:inline-block}.g{background:#34d399}.r{background:#f87171}.y{background:#fbbf24}
.btn{display:block;width:100%;padding:10px 16px;border-radius:8px;border:none;font-size:14px;font-weight:500;cursor:pointer;text-align:center;margin-bottom:8px}
.p{background:#10b981;color:#fff}.p:hover{background:#059669}.s{background:#27272a;color:#fafafa}.s:hover{background:#3f3f46}
.btn:disabled{opacity:.4;cursor:default}
code{display:block;background:#09090b;padding:8px;border-radius:6px;font-size:12px;color:#34d399;word-break:break-all;margin-top:4px}
.st{display:flex;gap:12px;margin-bottom:14px;align-items:flex-start}
.sn{width:24px;height:24px;border-radius:50%;background:#27272a;display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;flex-shrink:0;margin-top:1px}
.sb{font-size:13px;color:#a1a1aa;line-height:1.5}.sb s{color:#fafafa}
.m{padding:8px 12px;border-radius:6px;font-size:13px;margin-top:12px;display:none}
.m.ok{display:block;background:#34d39915;color:#34d399}.m.bad{display:block;background:#f8717115;color:#f87171}
</style></head><body>
<div class=card>
<h1>YouBox Browser</h1>
<p class=sub>Удалённый браузер для входа в YouTube</p>
<div class=stat><span class="dot" id=dt></span><span id=st>Загрузка...</span></div>
<button class="btn p" id=ob onclick="ob()">Открыть браузер и YouTube</button>
<button class="btn s" id=eb onclick="ex()">Экспортировать cookies</button>
<div id=instr style="margin-top:24px"></div>
<div id=msg class=m></div></div>
<script>
async function rf(){try{const r=await fetch('/status');const d=await r.json();
document.getElementById('dt').className='dot '+(d.running?'g':d.profileExists?'y':'r');
document.getElementById('st').textContent=d.running?'Browser running'+(d.cdpPort?' on port '+d.cdpPort:''):d.profileExists?'Profile exists':'Browser not started';
let html='';if(d.running){html=\`<div style="font-weight:600;font-size:13px;margin-bottom:12px">How to connect:</div>
<div class=st><div class=sn>1</div><div class=sb>Run in terminal:<code>ssh -L 3808:localhost:3808 root@youbox.pupupu.cloud</code></div></div>
<div class=st><div class=sn>2</div><div class=sb>Open chrome://inspect in Chrome, add localhost:3808, click inspect on YouTube tab</div></div>
<div class=st><div class=sn>3</div><div class=sb>Log in, then click "Export cookies" above</div></div>\`}
document.getElementById('instr').innerHTML=html}catch(e){}
setTimeout(rf,5000)}
async function ob(){document.getElementById('ob').disabled=true;document.getElementById('ob').textContent='Starting...';
await fetch('/open-youtube',{method:'POST'});document.getElementById('ob').disabled=false;document.getElementById('ob').textContent='Open browser and YouTube';rf()}
async function ex(){document.getElementById('eb').disabled=true;document.getElementById('eb').textContent='Exporting...';
try{const r=await fetch('/export',{method:'POST'});if(r.ok)show('Cookies exported!','ok');else show(await r.text(),'bad')}catch(e){show(e.message,'bad')}
document.getElementById('eb').disabled=false;document.getElementById('eb').textContent='Export cookies'}
function show(t,c){const e=document.getElementById('msg');e.textContent=t;e.className='m '+c;setTimeout(()=>e.style.display='none',5000)}
rf()
</script></body></html>`

app.get('/', (_req, res) => res.type('html').send(LANDING))

// ─── CDP proxy (for chrome://inspect via port 3808) ──────

app.get('/json/version', async (_req, res) => {
  if (!browserRunning) return res.json({})
  let data = await cdpFetch('/json/version')
  if (data) data = data.replace(/:3809\//g, ':3808/')
  if (data) { res.setHeader('Content-Type', 'application/json'); res.send(data) }
  else res.json({})
})

app.get('/json', async (_req, res) => {
  if (!browserRunning) return res.json([])
  let data = await cdpFetch('/json')
  if (data) data = data.replace(/:3809\//g, ':3808/')
  if (data) { res.setHeader('Content-Type', 'application/json'); res.send(data) }
  else res.json([])
})

app.get('/json/list', async (_req, res) => {
  if (!browserRunning) return res.json([])
  let data = await cdpFetch('/json/list')
  if (data) data = data.replace(/:3809\//g, ':3808/')
  if (data) { res.setHeader('Content-Type', 'application/json'); res.send(data) }
  else res.json([])
})

// WebSocket proxy for CDP devtools
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`[sidecar] listening on ${PORT}, CDP: ${BROWSER_PORT}`)
})

server.on('upgrade', (req, socket, head) => {
  if (!browserRunning) { socket.destroy(); return }
  const cdp = net.connect(BROWSER_PORT, '127.0.0.1', () => {
    cdp.write(`${req.method} ${req.url} HTTP/${req.httpVersion}\r\n` +
      Object.entries(req.headers).map(([k, v]) => `${k}: ${v}`).join('\r\n') + '\r\n\r\n')
    if (head.length > 0) cdp.write(head)
    socket.pipe(cdp).pipe(socket)
  })
  cdp.on('error', () => socket.destroy())
  socket.on('error', () => cdp.destroy())
})

app.get('/status', async (_req, res) => {
  const profileExists = fs.existsSync(PROFILE_DIR) && fs.readdirSync(PROFILE_DIR).length > 0
  let pages = []
  if (browserRunning) {
    const json = await cdpFetch('/json')
    if (json) { try { pages = JSON.parse(json).map(p => ({ url: p.url, title: p.title })) } catch {} }
  }
  res.json({ running: browserRunning, profileExists, cdpPort: browserRunning ? BROWSER_PORT : null, pages, error: browserError })
})

app.post('/open-youtube', async (_req, res) => {
  if (!browserRunning || !browserProcess) {
    const ok = await startBrowser()
    if (!ok) return res.status(500).json({ ok: false, error: browserError })
  }
  console.log('[browser] navigating to YouTube...')
  await cdpNavigate('https://www.youtube.com')
  console.log('[browser] navigation done')
  res.json({ ok: true })
})

const NETSCAPE_HEADER = '# Netscape HTTP Cookie File\n# https://curl.haxx.se/rfc/cookie_spec.html\n# Generated by YouBox\n'

app.post('/export', async (_req, res) => {
  const tmpFile = '/tmp/youbox-export.txt'
  try {
    const child = spawn('yt-dlp', [
      '--cookies-from-browser', `chromium:${PROFILE_DIR}`,
      '--cookies', tmpFile,
      '--no-warnings', '--skip-download', '--flat-playlist', '--ignore-errors',
      'https://www.youtube.com/',
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 15000, env: { ...process.env, HOME: '/tmp' } })

    let stderr = ''
    child.stderr.on('data', c => stderr += c.toString())

    child.on('close', (code) => {
      if (code === 0 && fs.existsSync(tmpFile)) {
        let content = fs.readFileSync(tmpFile, 'utf-8')
        if (!content.startsWith('# Netscape')) content = NETSCAPE_HEADER + '\n' + content
        fs.unlinkSync(tmpFile)
        console.log('[browser] exported cookies via yt-dlp')
        res.setHeader('Content-Type', 'text/plain')
        res.send(content)
      } else {
        console.log('[browser] export failed:', stderr.slice(0, 200))
        res.status(400).send(stderr.slice(0, 200) || 'No cookies found')
      }
    })
  } catch (err) {
    res.status(500).send(err.message)
  }
})

app.post('/validate', async (_req, res) => {
  try {
    const child = spawn('yt-dlp', [
      '--cookies-from-browser', `chromium:${PROFILE_DIR}`,
      '--no-warnings', '--dump-json', '--skip-download', '--flat-playlist', '--ignore-errors',
      'https://www.youtube.com/',
    ], { stdio: ['ignore', 'pipe', 'pipe'], timeout: 10000, env: { ...process.env, HOME: '/tmp' } })
    child.on('close', (code) => res.json({ valid: code === 0 }))
  } catch { res.json({ valid: false }) }
})

app.get('/health', (_req, res) => res.json({ ok: true, running: browserRunning }))