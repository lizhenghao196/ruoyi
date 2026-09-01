<template>
  <div class="app-container">
    <el-table
      :data="tableData"
      border
      height="500"
      style="width: 100%; margin-bottom: 30px"
    >
      <el-table-column prop="system" label="系统" width="80"> </el-table-column>
      <el-table-column prop="emergency" label="应急预案覆盖率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            应急预案覆盖率%
            <el-tooltip
              class="item"
              effect="dark"
              content="覆盖所有组件和节点"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="tool" label="切换演练覆盖率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            切换演练覆盖率%
            <el-tooltip
              class="item"
              effect="dark"
              content="本地 同城 异地"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="autoTool" label="应急处置自动化率%">
      </el-table-column>
      <el-table-column prop="repeat" label="重复告警数">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            重复告警数
            <el-tooltip
              class="item"
              effect="dark"
              content="近2个月告警相似度≥70%"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
        <template slot-scope="scope">
          <div class="flx-center alarm-id">
            {{ scope.row.repeat.length }}
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="exact" label="告警根因定位率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            告警根因定位率%
            <el-tooltip
              class="item"
              effect="dark"
              content="告警根因定位率"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="cover" label="CICD变更智能化率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            CICD变更智能化率%
            <el-tooltip
              class="item"
              effect="dark"
              content="近2个月CICD编排使用率"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="auto" label="ITSM变更智能化率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            ITSM变更智能化率%
            <el-tooltip
              class="item"
              effect="dark"
              content="近2个月ITSM编排使用率"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="capacity" label="智能场景个数"> </el-table-column>
      <el-table-column prop="itsmAuto" label="ITSM自动提单率%">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            ITSM自动提单率%
            <el-tooltip
              class="item"
              effect="dark"
              content="根据工具自动提交基础设施单的占比"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
      <el-table-column prop="itsmTemplate" label="ITSM变更模板数量">
        <template slot="header" slot-scope="scope">
          <div class="flx-div">
            ITSM变更模板数量
            <el-tooltip
              class="item"
              effect="dark"
              content="各系统基础设施变更模板数量"
              placement="top"
            >
              <i class="el-icon-info"></i>
            </el-tooltip>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </div>
</template>

<script>
export default {
  data() {
    return {
      tableData: [
        {
          system: "系统A",
          emergency: 80,
          tool: 70,
          autoTool: 60,
          repeat: [1, 2, 3],
          exact: 90,
          cover: 85,
          auto: 75,
          capacity: 10,
          itsmAuto: 65,
          itsmTemplate: 5,
        },
        {
          system: "系统B",
          emergency: 85,
          tool: 75,
          autoTool: 65,
          repeat: [4, 5],
          exact: 92,
          cover: 88,
          auto: 78,
          capacity: 12,
          itsmAuto: 70,
          itsmTemplate: 6,
        },
      ],
    };
  },
  computed: {},
  mounted() {},
  beforeDestroy() {},
  methods: {},
};
</script>
