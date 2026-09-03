<template>
  <div class="app-container">
    <iframe
      ref="frame"
      src="/switchRepayment/index.html"
      class="switch-frame"
      frameborder="0"
    ></iframe>
  </div>
</template>

<script>
export default {
  name: 'SwitchRepayment',
  data() {
    return {}
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
