// CDP：检查集群关系 tab 的 DOM 渲染情况
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
  // 找到已打开的系统画像页 tab（复用现有页面）
  const tabs = await getJson('/json/list')
  const tab = tabs.find(t => t.url.includes('localhost')) || tabs[0]
  const ws = new WebSocket(tab.webSocketDebuggerUrl)
  let id = 0
  const pending = new Map()
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const mid = ++id
    pending.set(mid, { resolve, reject })
    ws.send(JSON.stringify({ id: mid, method, params }))
  })
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data)
    if (m.id && pending.has(m.id)) {
      const p = pending.get(m.id)
      pending.delete(m.id)
      m.error ? p.reject(new Error(m.error.message)) : p.resolve(m.result)
    }
  }
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true })
    return r.result ? r.result.value : undefined
  }

  const info = await evalJs(`(() => {
    const groups = document.querySelectorAll('.profile-relation-group')
    const perGroup = []
    groups.forEach(g => {
      const title = g.querySelector('.profile-relation-title')
      const cards = g.querySelectorAll('.profile-relation-card')
      const flow = g.querySelector('.profile-relation-flow')
      perGroup.push({
        title: title ? title.textContent.trim() : '?',
        cards: cards.length,
        collapsed: flow ? flow.classList.contains('is-collapsed') : false,
        sh: flow ? flow.scrollHeight : 0,
        ch: flow ? flow.clientHeight : 0
      })
    })
    return {
      url: location.href,
      groups: perGroup,
      totalCards: document.querySelectorAll('.profile-relation-card').length,
      totalElCard: document.querySelectorAll('.profile-relation-panel .el-card').length,
      toggles: document.querySelectorAll('.profile-relation-toggle').length,
      activeTabName: document.querySelector('.el-tabs__item.is-active') ? document.querySelector('.el-tabs__item.is-active').textContent.trim() : '?'
    }
  })()`)
  console.log(JSON.stringify(info, null, 1))
  process.exit(0)
})().catch(e => { console.error('ERR', e.message); process.exit(1) })
