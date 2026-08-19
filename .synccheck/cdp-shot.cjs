// 通过 CDP 打开页面 → 等真实时间 → 截图 + 收集 console/异常
// 用法: node cdp-shot.cjs <url> <out.png> <waitMs> <waitAfterMs>
const fs = require('fs')
const http = require('http')

function getJson(path, method = 'GET') {
  return new Promise((resolve, reject) => {
    const req = http.request({ host: '127.0.0.1', port: 9222, path, method }, res => {
      let d = ''
      res.on('data', c => { d += c })
      res.on('end', () => { try { resolve(JSON.parse(d)) } catch (e) { reject(e) } })
    })
    req.on('error', reject)
    req.end()
  })
}

;(async () => {
  const url = process.argv[2] || 'http://localhost:7777/setcookie.html'
  const outFile = process.argv[3] || 'shot.png'
  const waitMs = parseInt(process.argv[4] || '10000', 10)

  const tab = await getJson('/json/new?' + encodeURIComponent(url), 'PUT')
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const consoleMsgs = []
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  const sleep = ms => new Promise(r => setTimeout(r, ms))

  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
    } else if (m.method === 'Runtime.consoleAPICalled') {
      consoleMsgs.push('CONSOLE: ' + m.params.args.map(a => a.value || a.description || '').join(' '))
    } else if (m.method === 'Runtime.exceptionThrown') {
      consoleMsgs.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 400))
    } else if (m.method === 'Log.entryAdded' && m.params.entry.level === 'error') {
      consoleMsgs.push('LOGERR: ' + m.params.entry.text.slice(0, 400))
    }
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Log.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  console.log('tab opened:', tab.id, 'waiting', waitMs, 'ms')
  await sleep(waitMs)
  const shot = await send('Page.captureScreenshot', { format: 'png' })
  fs.writeFileSync(outFile, Buffer.from(shot.data, 'base64'))
  console.log('saved', outFile, fs.statSync(outFile).size, 'bytes')
  if (consoleMsgs.length) {
    console.log('---- console ----')
    console.log(consoleMsgs.join('\n'))
  }
  process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
