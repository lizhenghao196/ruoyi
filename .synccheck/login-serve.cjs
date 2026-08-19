// 登录 RuoYi 后端拿 token，并在 7777 端口起一个设置 Admin-Token cookie 后跳转系统画像页的小服务
const http = require('http')

;(async () => {
  try {
    const res = await fetch('http://localhost/dev-api/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: 'admin', password: 'admin123', code: '', uuid: '' })
    })
    const j = await res.json()
    if (j.code !== 200) {
      console.log('LOGIN FAILED:', JSON.stringify(j))
      process.exit(1)
    }
    const token = j.token
    console.log('login OK, token length', token.length)

    const server = http.createServer((req, res2) => {
      res2.setHeader('Content-Type', 'text/html')
      res2.end(`<script>document.cookie='Admin-Token=${token};path=/';location.href='http://localhost/tool/systemProfile';</script>`)
    })
    server.listen(7777, () => console.log('setcookie server: http://localhost:7777/setcookie.html'))
    setTimeout(() => server.close(), 600000)
  } catch (e) {
    console.log('ERROR:', e.message)
    process.exit(1)
  }
})()
