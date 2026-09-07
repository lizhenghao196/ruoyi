<template>
  <div class="app-container">
    <iframe
      ref="frame"
      src="/switchRepayment/index.html"
      class="switch-frame"
      frameborder="0"
      @load="pushOperator"
    ></iframe>
  </div>
</template>

<script>
export default {
  name: 'SwitchRepayment',
  data() {
    return {}
  },
  mounted() {
    window.addEventListener('message', this.onFrameMessage)
  },
  beforeDestroy() {
    window.removeEventListener('message', this.onFrameMessage)
  },
  methods: {
    // iframe 页面加载完成发来 ready 时，再次推送操作人（防止消息早于 iframe 内监听注册）
    onFrameMessage(event) {
      if (event.origin !== window.location.origin) {
        return
      }
      const data = event.data || {}
      if (data.source === 'switchRepayment' && data.type === 'ready') {
        this.pushOperator()
      }
    },
    // 将当前登录用户名（RuoYi /getInfo 接口的 userName）推送给 iframe 页面
    pushOperator() {
      const frame = this.$refs.frame
      if (!frame || !frame.contentWindow) {
        return
      }
      frame.contentWindow.postMessage({
        source: 'ruoyi-main',
        type: 'operator',
        operator: this.$store.state.user.name
      }, window.location.origin)
    }
  }
}
</script>

<style lang="scss" scoped>
.switch-frame {
  width: 100%;
  height: calc(100vh - 170px);
  min-height: 800px;
  border: none;
  background: #fff;
}
</style>
