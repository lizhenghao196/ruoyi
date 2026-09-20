<template>
  <div class="exec-plan-page">
    <div class="exec-plan-card">
      <div class="exec-plan-card__head">
        <span class="exec-plan-card__icon">
          <svg-icon icon-class="job" />
        </span>
        <div class="exec-plan-card__title">
          <h2>变更执行计划</h2>
          <p>汇总 {{ systems.join(' / ') }} 全部环境的执行计划，在新标签页打开执行页面</p>
        </div>
      </div>

      <button
        class="exec-plan-btn"
        type="button"
        :disabled="loading"
        @click="handleStart"
      >
        <span class="exec-plan-btn__icon">
          <svg-icon :icon-class="loading ? 'time' : 'job'" />
        </span>
        <span>{{ loading ? '正在获取执行计划…' : '开始执行' }}</span>
      </button>

      <p v-if="tip" class="exec-plan-card__tip" :class="{ 'is-error': isError }">
        {{ tip }}
      </p>
    </div>
  </div>
</template>

<script>
import { getPlanList, pickExecPlanIds, pickPayload, EXEC_PLAN_SYSTEMS } from '@/api/tool/execPlan'

// 执行页面路由（与 store/modules/permission.js 中的 STANDALONE_PATHS 保持一致）
const EXEC_PAGE_PATH = '/tool/execPage'

export default {
  name: 'ExecPlan',
  data() {
    return {
      systems: EXEC_PLAN_SYSTEMS,
      loading: false,
      tip: '',
      isError: false
    }
  },
  methods: {
    async handleStart() {
      if (this.loading) {
        return
      }
      this.loading = true
      this.tip = ''
      this.isError = false
      // 先同步占位一个新标签页：await 之后再 window.open 会被浏览器当作弹窗拦截
      const tab = window.open('', '_blank')
      try {
        const res = await getPlanList()
        // 计划列表在 `rows`，但别写死 —— 也可能在 `data`（见 pickPayload 的说明）
        const ids = pickExecPlanIds(pickPayload(res), this.systems)
        if (!ids.length) {
          if (tab) {
            tab.close()
          }
          this.isError = true
          this.tip = '未取到任何执行计划 ID'
          return
        }
        // 所有 aripExecPlanId 通过 URL query 传给执行页面
        const { href } = this.$router.resolve({
          path: EXEC_PAGE_PATH,
          query: { ids: ids.join(',') }
        })
        const url = window.location.origin + href
        if (tab) {
          tab.location.replace(url)
        } else {
          window.open(url, '_blank')
        }
        this.tip = `已取到 ${ids.length} 个执行计划 ID，已在新标签页打开执行页面`
      } catch (e) {
        if (tab) {
          tab.close()
        }
        this.isError = true
        this.tip = '获取执行计划失败，请重试'
      } finally {
        this.loading = false
      }
    }
  }
}
</script>

<style lang="scss" scoped>
.exec-plan-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: calc(100vh - 84px);
  padding: 24px;
  box-sizing: border-box;

  --ep-panel: #ffffff;
  --ep-border: #e6eaf2;
  --ep-text: #1f2937;
  --ep-text-2: #5b6b82;
  --ep-text-3: #97a3b6;
  --ep-accent: var(--current-color, #409eff);
  --ep-accent-soft: #eef4fd;
}

.exec-plan-card {
  width: 100%;
  max-width: 460px;
  padding: 28px 28px 24px;
  background: var(--ep-panel);
  border: 1px solid var(--ep-border);
  border-radius: 14px;
  box-shadow: 0 12px 32px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.04);

  &__head {
    display: flex;
    align-items: flex-start;
    margin-bottom: 22px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 34px;
    height: 34px;
    margin-right: 12px;
    border-radius: 10px;
    background: var(--ep-accent-soft);
    color: var(--ep-accent);
    font-size: 17px;
  }

  &__title {
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
      line-height: 20px;
      letter-spacing: 0.2px;
      color: var(--ep-text);
    }

    p {
      margin: 5px 0 0;
      font-size: 12px;
      line-height: 17px;
      color: var(--ep-text-3);
    }
  }

  &__tip {
    margin: 14px 0 0;
    font-size: 12px;
    line-height: 17px;
    color: var(--ep-text-2);

    &.is-error {
      color: #d14343;
    }
  }
}

.exec-plan-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 42px;
  padding: 0 18px;
  border: none;
  border-radius: 10px;
  background: var(--ep-accent);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  letter-spacing: 0.3px;
  cursor: pointer;
  transition: box-shadow 0.2s ease, transform 0.2s ease, opacity 0.2s ease;

  &:hover:not(:disabled) {
    box-shadow: 0 6px 18px rgba(64, 158, 255, 0.32);
  }

  &:active:not(:disabled) {
    transform: translateY(1px);
  }

  &:disabled {
    opacity: 0.65;
    cursor: not-allowed;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    margin-right: 8px;
    font-size: 15px;
  }
}
</style>
