<template>
  <div class="component-page">
    <!-- 横向指标组件：深蓝渐变 box，四个指标横排，总宽不超过 900px -->
    <div class="component-card">
      <!-- 左侧品牌区：标题 + 副标题 -->
      <div class="component-card__brand">
        <i class="el-icon-box component-card__brand-icon" />
        <div class="component-card__brand-text">
          <p class="component-card__title">组件</p>
          <p class="component-card__sub">月度报告覆盖情况</p>
        </div>
      </div>

      <span class="component-card__divider" />

      <!-- 右侧指标区：总数 / 已有报告 / 需补齐 / 覆盖率 -->
      <div class="component-card__stats">
        <div class="component-card__stat">
          <span class="component-card__value">202</span>
          <span class="component-card__label">四个级别系统总数</span>
        </div>
        <div class="component-card__stat">
          <span class="component-card__value">184</span>
          <span class="component-card__label">已存在阅读报告的系统</span>
        </div>
        <div class="component-card__stat">
          <span class="component-card__value">18</span>
          <span class="component-card__label">仍需补齐报告的系统</span>
        </div>
        <div class="component-card__stat">
          <span class="component-card__value is-rate">91.1%</span>
          <span class="component-card__label">月度报告覆盖率</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'Component'
}
</script>

<style lang="scss" scoped>
.component-page {
  padding: 20px;
}

/* 渐变 box：120deg 深蓝渐变 + 右上角一点柔光，白色系文字保证对比度 */
.component-card {
  box-sizing: border-box;
  width: 900px;
  max-width: 100%;
  display: flex;
  align-items: center;
  gap: 26px;
  padding: 20px 28px;
  border-radius: 12px;
  background:
    radial-gradient(circle at 92% -30%, rgba(255, 255, 255, 0.09), transparent 45%),
    linear-gradient(120deg, #173f5f, #20577c);
  box-shadow: 0 6px 18px rgba(23, 63, 95, 0.25);

  /* 品牌区：图标 + 标题 */
  &__brand {
    flex-shrink: 0;
    display: flex;
    align-items: center;
    gap: 12px;
  }

  &__brand-icon {
    font-size: 26px;
    color: rgba(255, 255, 255, 0.75);
  }

  &__title {
    margin: 0;
    font-size: 19px;
    font-weight: 700;
    color: #fff;
    letter-spacing: 2px;
    line-height: 1.2;
  }

  &__sub {
    margin: 3px 0 0;
    font-size: 11px;
    color: rgba(255, 255, 255, 0.5);
    letter-spacing: 0.5px;
  }

  /* 品牌区与指标区的分隔竖线 */
  &__divider {
    flex-shrink: 0;
    width: 1px;
    height: 44px;
    background: rgba(255, 255, 255, 0.18);
  }

  /* 指标区：四列均分剩余空间 */
  &__stats {
    flex: 1;
    min-width: 0;
    display: flex;
    align-items: center;
  }

  &__stat {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 5px;
    padding: 0 14px;
  }

  &__stat + &__stat {
    border-left: 1px solid rgba(255, 255, 255, 0.12);
  }

  &__value {
    font-size: 26px;
    font-weight: 700;
    line-height: 1.1;
    color: #fff;
    font-variant-numeric: tabular-nums;

    /* 覆盖率：浅青色点缀，与其余纯白数字区分 */
    &.is-rate {
      color: #7fd3ff;
    }
  }

  &__label {
    font-size: 11.5px;
    line-height: 1.3;
    text-align: center;
    color: rgba(255, 255, 255, 0.62);
    white-space: nowrap;
  }
}
</style>
