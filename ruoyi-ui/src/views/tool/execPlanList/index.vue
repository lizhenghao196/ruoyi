<template>
  <div class="epl">
    <div class="epl__card">
      <div class="epl__head">
        <span class="epl__icon">
          <svg-icon icon-class="list" />
        </span>
        <div class="epl__title">
          <h2>变更计划列表</h2>
          <p>
            共 {{ rows.length }} 个系统 · {{ totalPlanCount }} 条计划；点击「查看执行」把该系统
            <strong>全部环境</strong>的执行计划在新标签页打开
          </p>
        </div>
        <div class="epl__tools">
          <el-button
            size="mini"
            icon="el-icon-refresh"
            :loading="loading"
            @click="fetchPlans"
            >刷新</el-button
          >
        </div>
      </div>

      <!--
        ⚠️ 这张表有 type="expand" 列，所以**任何列都不能加 fixed** ——
           展开列 + fixed 列在 element-ui 2.15 下会出现错位（列宽与表体对不上）。
      -->
      <el-table
        v-loading="loading"
        class="epl__table"
        :data="rows"
        row-key="rowKey"
        border
        stripe
        size="mini"
        :empty-text="loading ? '正在加载…' : '暂无变更计划'"
      >
        <!-- 展开行：该系统的计划明细（一个环境一条计划） -->
        <el-table-column type="expand">
          <template slot-scope="{ row }">
            <div class="epl-detail">
              <table class="epl-detail__table">
                <thead>
                  <tr>
                    <th>环境</th>
                    <th>计划名称</th>
                    <th>执行计划 ID</th>
                    <th>状态</th>
                    <th>计划开始</th>
                    <th>计划结束</th>
                    <th>工单</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="plan in row.plans" :key="plan.aripExecPlanId">
                    <td>
                      <span class="epl-env">{{ plan.aripExecEnv || "—" }}</span>
                    </td>
                    <td class="epl-detail__name" :title="plan.aripExecPlanName">
                      {{ plan.aripExecPlanName || "—" }}
                    </td>
                    <td class="epl-detail__id">{{ plan.aripExecPlanId }}</td>
                    <td>
                      <el-tag
                        size="mini"
                        :type="statusType(plan.aripExecStatus)"
                        disable-transitions
                        >{{ plan.aripExecStatus || "—" }}</el-tag
                      >
                    </td>
                    <td class="epl-detail__time">
                      {{ plan.aripExecPlanStart || "—" }}
                    </td>
                    <td class="epl-detail__time">
                      {{ plan.aripExecPlanEnd || "—" }}
                    </td>
                    <td class="epl-detail__orders">
                      {{ plan.aripExecOrderList || "—" }}
                    </td>
                  </tr>
                  <tr v-if="!row.plans.length">
                    <td class="epl-detail__empty" colspan="7">暂无计划</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </template>
        </el-table-column>

        <el-table-column
          label="系统"
          prop="system"
          width="110"
          show-overflow-tooltip
        />

        <el-table-column label="执行日期" prop="date" width="120" />

        <!-- 环境：该系统下 plans 覆盖到的全部环境，一个环境一个标签 -->
        <el-table-column label="环境" min-width="200">
          <template slot-scope="{ row }">
            <span v-if="!row.plans.length" class="epl-muted">—</span>
            <span v-else class="epl-envs">
              <span
                v-for="plan in row.plans"
                :key="plan.aripExecPlanId"
                class="epl-env"
                :title="plan.aripExecPlanName || ''"
                >{{ plan.aripExecEnv || "—" }}</span
              >
            </span>
          </template>
        </el-table-column>

        <el-table-column label="计划数" width="82" align="center">
          <template slot-scope="{ row }">
            <span class="epl-num">{{ row.plans.length }}</span>
          </template>
        </el-table-column>

        <el-table-column label="工单" min-width="200">
          <template slot-scope="{ row }">
            <span v-if="!row.orders.length" class="epl-muted">—</span>
            <span v-else class="epl-orders">
              <span
                v-for="order in row.orders"
                :key="order.orderId"
                class="epl-order"
                :class="{ 'is-off': order.belong === 'N' }"
                :title="
                  (order.belong === 'N' ? '[非本次] ' : '') +
                  order.orderId +
                  (order.env ? ' · ' + order.env : '')
                "
                >{{ order.orderId }}</span
              >
            </span>
          </template>
        </el-table-column>

        <!-- 操作：把该系统全部环境的 aripExecPlanId 传到执行界面简版 -->
        <el-table-column label="操作" width="110" align="center">
          <template slot-scope="{ row }">
            <el-button
              type="text"
              size="mini"
              :disabled="!row.plans.length"
              @click="handleExec(row)"
              >查看执行</el-button
            >
          </template>
        </el-table-column>
      </el-table>
    </div>
  </div>
</template>

<script>
/**
 * 变更计划列表（页面一）
 * ==========================================================================
 * 数据来源：mockData/res.js 的 planRes（经 @/api/tool/execPageSimple 的 getPlanList）
 *   planRes.rows[] = {
 *     system, date,
 *     orders: [ { belong, orderId, env } ],          // 工单
 *     plans:  [ { aripExecPlanId, aripExecEnv, ... } ] // 计划：一个环境一条
 *   }
 * 一行 = 一个系统；「查看执行」把该行 plans 里**全部环境**的 aripExecPlanId 一起传走，
 * 在新标签页打开「执行界面简版」（见 execPageSimple/index.vue）。
 *
 * ⚠️ 本页与 execPlan（旧的单按钮页面）**没有任何共享**：接口、组件、方法都是自己的。
 *    用户明确要求两套页面低耦合，别为了「复用」把 import 指向 @/api/tool/execPlan。
 * ==========================================================================
 */
import { getPlanList, pickPayload } from "@/api/tool/execPageSimple";

// 执行界面简版的路由（与 store/modules/permission.js 里的 STANDALONE_PATHS 保持一致）
const EXEC_SIMPLE_PATH = "/tool/execPageSimple";

export default {
  name: "ExecPlanList",
  data() {
    return {
      loading: false,
      rows: [],
    };
  },
  computed: {
    totalPlanCount() {
      return this.rows.reduce((n, row) => n + row.plans.length, 0);
    },
  },
  created() {
    this.fetchPlans();
  },
  methods: {
    /** 拉全量发布计划列表（planRes），按系统分组成表格行 */
    async fetchPlans() {
      if (this.loading) {
        return;
      }
      this.loading = true;
      try {
        const res = await getPlanList();
        // 计划列表在 `rows`，但别写死 —— 也可能在 `data`（见 pickPayload 的说明）
        const list = pickPayload(res);
        this.rows = (Array.isArray(list) ? list : []).map((item, index) => {
          const plans = (item && Array.isArray(item.plans) ? item.plans : [])
            .filter((p) => p && p.aripExecPlanId !== undefined && p.aripExecPlanId !== null)
            // 环境顺序按 aripExecEnv 排一下，保证同一系统每次渲染的标签顺序一致
            .slice()
            .sort((a, b) =>
              String(a.aripExecEnv || "").localeCompare(String(b.aripExecEnv || ""))
            );
          const orders = item && Array.isArray(item.orders) ? item.orders : [];
          return {
            // 展开行 / v-for 的 key：system + date 已经够唯一，再兜一层下标
            rowKey: `${(item && item.system) || "?"}-${(item && item.date) || index}-${index}`,
            system: (item && item.system) || "—",
            date: (item && item.date) || "—",
            plans,
            orders,
          };
        });
      } catch (e) {
        console.error("[变更计划列表] 获取计划失败", e);
        this.$modal.msgError((e && e.message) || "获取变更计划失败");
      } finally {
        this.loading = false;
      }
    },

    /**
     * 点「查看执行」：把该系统的**全部环境**（plans）的 aripExecPlanId 汇总，
     * 在新标签页打开执行界面简版。
     *
     * 传参：
     *   ids   全部 aripExecPlanId，逗号拼接（执行页面的主参数）
     *   sys   系统编码（页头标题用）
     *   envs  精简环境信息 JSON（[{ planId, env, planName }]）——
     *         纯粹给首屏占位用，详情接口回来后执行页面一律以接口数据为准。
     *
     * ⚠️ 必须**先同步开一个空标签页**再跳转：`await` 之后再 window.open
     *    会被浏览器当成弹窗拦截（这是 execPlan 页面踩过的同一个坑）。
     */
    handleExec(row) {
      const ids = [];
      const seen = new Set();
      const envs = [];
      (row.plans || []).forEach((plan) => {
        const id = plan && plan.aripExecPlanId;
        if (id === undefined || id === null || id === "") {
          return;
        }
        if (seen.has(id)) {
          return;
        }
        seen.add(id);
        ids.push(id);
        envs.push({
          planId: id,
          env: plan.aripExecEnv || "",
          planName: plan.aripExecPlanName || "",
        });
      });

      if (!ids.length) {
        this.$modal.msgWarning(`「${row.system}」下没有可执行的计划`);
        return;
      }

      const { href } = this.$router.resolve({
        path: EXEC_SIMPLE_PATH,
        query: {
          ids: ids.join(","),
          sys: row.system || "",
          // $router.resolve 会自己 encodeURIComponent，这里给原始 JSON 即可
          envs: JSON.stringify(envs),
        },
      });
      const url = window.location.origin + href;
      window.open(url, "_blank");
    },

    /** aripExecStatus -> el-tag 的 type（只为配色，不代表第二套字典） */
    statusType(status) {
      const map = {
        SUCCESS: "success",
        FAILED: "danger",
        RUNNING: "primary",
        CONFIRM: "warning",
        STOP: "warning",
        CANCELLED: "info",
        INIT: "info",
      };
      return map[status] || "info";
    },
  },
};
</script>

<style lang="scss" scoped>
.epl {
  padding: 16px;
  min-height: calc(100vh - 84px);
  box-sizing: border-box;

  --epl-border: #e6eaf2;
  --epl-text: #1f2937;
  --epl-text-2: #5b6b82;
  --epl-text-3: #97a3b6;
  --epl-accent: var(--current-color, #409eff);
  --epl-accent-soft: #eef4fd;

  &__card {
    padding: 16px 18px 18px;
    background: #fff;
    border: 1px solid var(--epl-border);
    border-radius: 12px;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.03);
  }

  &__head {
    display: flex;
    align-items: center;
    margin-bottom: 14px;
  }

  &__icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex: none;
    width: 32px;
    height: 32px;
    margin-right: 11px;
    border-radius: 9px;
    background: var(--epl-accent-soft);
    color: var(--epl-accent);
    font-size: 16px;
  }

  &__title {
    flex: 1;
    min-width: 0;

    h2 {
      margin: 0;
      font-size: 15px;
      font-weight: 600;
      line-height: 20px;
      letter-spacing: 0.2px;
      color: var(--epl-text);
    }

    p {
      margin: 3px 0 0;
      font-size: 12px;
      line-height: 16px;
      color: var(--epl-text-3);

      strong {
        font-weight: 600;
        color: var(--epl-accent);
      }
    }
  }

  &__tools {
    flex: none;
    margin-left: 12px;
  }

  /*
    ⚠️ 表格底部那条横线由 element-ui 的 `.el-table::before` 画出来 ——
       **不要写 `.el-table { &::before { display: none } }`**，否则底部会敞口。
  */
  &__table {
    width: 100%;
  }
}

/* 环境标签 / 工单标签：小圆角方块，颜色区分「环境」与「工单」两类信息 */
.epl-envs,
.epl-orders {
  display: inline-flex;
  flex-wrap: wrap;
  gap: 4px;
}

.epl-env {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 0 7px;
  border-radius: 5px;
  background: #f1f5fb;
  color: #4b6b96;
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.2px;
}

.epl-order {
  display: inline-flex;
  align-items: center;
  height: 19px;
  padding: 0 7px;
  border-radius: 5px;
  background: #f4f5f8;
  color: #7c8798;
  font-family: Menlo, Consolas, monospace;
  font-size: 10.5px;

  /* belong = 'N'：不属于本次执行范围的工单，弱化成灰色虚线，和有效的区分开 */
  &.is-off {
    border: 1px dashed #d8dee8;
    background: #fbfcfd;
    color: #aab4c2;
  }
}

.epl-num {
  font-family: Menlo, Consolas, monospace;
  font-size: 12px;
  font-weight: 700;
  color: var(--epl-text);
}

.epl-muted {
  color: var(--epl-text-3);
}

/* --------------------------- 展开行：计划明细 --------------------------- */
.epl-detail {
  padding: 4px 12px 12px 48px;
  background: #fafbfd;

  &__table {
    width: 100%;
    border-collapse: collapse;
    background: #fff;
    border: 1px solid var(--epl-border);
    border-radius: 8px;
    overflow: hidden;

    th,
    td {
      padding: 7px 10px;
      text-align: left;
      font-size: 11.5px;
      line-height: 16px;
      border-bottom: 1px solid #f1f4f8;
      vertical-align: middle;
    }

    th {
      background: #f7f9fc;
      color: var(--epl-text-2);
      font-weight: 600;
      letter-spacing: 0.2px;
      white-space: nowrap;
    }

    /* 最后一行不要下边框 —— 否则会和容器的 border 叠成双线 */
    tbody tr:last-child td {
      border-bottom: none;
    }

    tbody tr:hover td {
      background: #fafcff;
    }
  }

  &__name {
    max-width: 240px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    color: var(--epl-text);
  }

  &__id {
    font-family: Menlo, Consolas, monospace;
    color: var(--epl-text-2);
  }

  &__time {
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    color: #8593a6;
    white-space: nowrap;
  }

  &__orders {
    max-width: 260px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: Menlo, Consolas, monospace;
    font-size: 11px;
    color: #7c8798;
  }

  &__empty {
    padding: 14px;
    text-align: center;
    color: var(--epl-text-3);
  }
}
</style>
