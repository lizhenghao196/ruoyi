<template>
  <component :is="type" v-bind="linkProps(to)">
    <slot />
  </component>
</template>

<script>
import { isExternal } from '@/utils/validate'

export default {
  props: {
    to: {
      type: [String, Object],
      required: true
    },
    openTab: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    isExternal() {
      return isExternal(this.to)
    },
    type() {
      if (this.isExternal || this.openTab) {
        return 'a'
      }
      return 'router-link'
    }
  },
  methods: {
    linkProps(to) {
      if (this.isExternal) {
        return {
          href: to,
          target: '_blank',
          rel: 'noopener'
        }
      }
      if (this.openTab) {
        const resolved = this.$router.resolve(to)
        return {
          href: resolved.href,
          target: '_blank',
          rel: 'noopener'
        }
      }
      return {
        to: to
      }
    }
  }
}
</script>
