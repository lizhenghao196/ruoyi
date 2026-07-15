<template>
  <div class="monaco-editor-wrap" :style="{ height: computedHeight }">
    <div ref="editorContainer" class="monaco-editor-container" />
  </div>
</template>

<script>
import * as monaco from 'monaco-editor'

export default {
  name: 'MonacoEditor',

  props: {
    value: { type: String, default: '' },
    language: { type: String, default: 'json' },
    height: { type: [String, Number], default: '180px' },
    readOnly: { type: Boolean, default: false },
    theme: { type: String, default: 'vs' }
  },

  data() {
    return {
      editor: null,
      preventSync: false
    }
  },

  computed: {
    computedHeight() {
      const val = String(this.height)
      // 已经带了单位直接返回，否则补 px
      return /[a-z%]/i.test(val) ? val : val + 'px'
    }
  },

  watch: {
    value(newVal) {
      if (this.editor && !this.preventSync) {
        const currentVal = this.editor.getValue()
        if (currentVal !== newVal) {
          this.editor.setValue(newVal)
        }
      }
    },
    readOnly(val) {
      if (this.editor) {
        this.editor.updateOptions({ readOnly: val })
      }
    },
    theme(val) {
      if (this.editor) {
        monaco.editor.setTheme(val)
      }
    }
  },

  mounted() {
    this.initEditor()
    this.$nextTick(() => {
      window.addEventListener('resize', this.handleResize)
    })
  },

  beforeDestroy() {
    window.removeEventListener('resize', this.handleResize)
    if (this.editor) {
      this.editor.dispose()
      this.editor = null
    }
  },

  methods: {
    initEditor() {
      this.editor = monaco.editor.create(this.$refs.editorContainer, {
        value: this.value,
        language: this.language,
        theme: this.theme,
        readOnly: this.readOnly,
        automaticLayout: true,
        minimap: { enabled: false },
        scrollBeyondLastLine: false,
        fontSize: 13,
        lineNumbers: 'on',
        tabSize: 2,
        wordWrap: 'on',
        folding: true,
        renderLineHighlight: 'line',
        scrollbar: {
          verticalScrollbarSize: 6,
          horizontalScrollbarSize: 6
        }
      })

      this.editor.onDidChangeModelContent(() => {
        const newVal = this.editor.getValue()
        if (newVal !== this.value) {
          this.preventSync = true
          this.$emit('input', newVal)
          this.$nextTick(() => {
            this.preventSync = false
          })
        }
      })
    },

    handleResize() {
      if (this.editor) {
        this.editor.layout()
      }
    },

    format() {
      if (this.editor) {
        this.editor.getAction('editor.action.formatDocument').run()
      }
    }
  }
}
</script>

<style scoped>
.monaco-editor-wrap {
  border: 1px solid #DCDFE6;
  border-radius: 4px;
  overflow: hidden;
}

.monaco-editor-container {
  width: 100%;
  height: 100%;
}
</style>
