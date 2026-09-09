<template>
  <div class="app-container">
    <iframe
      ref="frame"
      :src="url"
      class="iframe-test-frame"
      frameborder="0"
    ></iframe>
  </div>
</template>

<script>
export default {
  name: 'IframeTest',
  data() {
    return {
      // 默认嵌入地址；可通过菜单路由参数或 ?url= 覆盖（如：/tool/iframeTest?url=http://10.0.0.1:8080/）
      url: 'https://www.baidu.com'
    }
  },
  created() {
    const queryUrl = this.$route.query.url
    if (queryUrl) {
      this.url = queryUrl
    }
  }
}
</script>

<style lang="scss" scoped>
.iframe-test-frame {
  width: 100%;
  height: calc(100vh - 170px);
  min-height: 800px;
  border: none;
  background: #fff;
}
</style>
