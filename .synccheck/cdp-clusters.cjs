// CDP：打开系统画像页 → 点集群关系 tab → 截图 → 统计/点击「展开全部」→ 再截图
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
  const out1 = process.argv[2] || '.synccheck/topo-tab.png'
  const out2 = process.argv[3] || '.synccheck/clusters-tab.png'
  const out3 = process.argv[4] || '.synccheck/clusters-expanded.png'

  const tab = await getJson('/json/new?' + encodeURIComponent('http://localhost:7777/setcookie.html'), 'PUT')
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const errors = []
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
    } else if (m.method === 'Runtime.exceptionThrown') {
      errors.push('EXCEPTION: ' + JSON.stringify(m.params.exceptionDetails).slice(0, 300))
    }
  }

  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result ? r.result.value : undefined
  }
  const shot = async (file) => {
    const s = await send('Page.captureScreenshot', { format: 'png' })
    fs.writeFileSync(file, Buffer.from(s.data, 'base64'))
    console.log('saved', file, fs.statSync(file).size, 'bytes')
  }

  await send('Page.enable')
  await send('Runtime.enable')
  await send('Emulation.setDeviceMetricsOverride', { width: 1920, height: 1080, deviceScaleFactor: 1, mobile: false })
  console.log('tab opened, waiting page load...')
  await sleep(12000)

  // 1. 默认 tab（组件拓扑）截图
  await shot(out1)

  // 2. 点击「集群关系」tab
  const clicked = await evalJs(`(() => { const el = document.querySelector('#tab-clusters'); if (el) { el.click(); return true } return false })()`)
  console.log('clicked #tab-clusters:', clicked)
  await sleep(1500)
  await shot(out2)

  // 3. 「展开全部」状态统计 + 点击第一个，再截图
  const stat = await evalJs(`(() => {
    const toggles = document.querySelectorAll('.profile-relation-toggle')
    const titles = document.querySelectorAll('.profile-relation-title')
    const cards = document.querySelectorAll('.profile-relation-card')
    const first = toggles[0]
    if (first) first.click()
    return { toggles: toggles.length, groups: titles.length, cards: cards.length }
  })()`)
  console.log('relation stats:', JSON.stringify(stat))
  await sleep(800)
  await shot(out3)

  // 4. 再读展开后的链接文案（应变成「收起」）
  const afterText = await evalJs(`(() => {
    const t = document.querySelectorAll('.profile-relation-toggle')
    return t.length ? t[0].textContent : 'none'
  })()`)
  console.log('first toggle text after click:', afterText)

  if (errors.length) console.log(errors.join('\n'))
  process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
