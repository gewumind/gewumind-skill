## ECharts 图表

> gewumind-boot 前端已集成 ECharts 6.x。动态 SFC 中可直接 `import * as echarts from 'echarts'` 使用。

---

### 使用方式

```vue
<script setup>
import * as echarts from 'echarts'
import { ref, onMounted, onBeforeUnmount } from 'vue'

const chartRef = ref(null)
let chartInstance = null

onMounted(() => {
  chartInstance = echarts.init(chartRef.value)
  chartInstance.setOption({
    tooltip: { trigger: 'axis' },
    xAxis: { type: 'category', data: [] },
    yAxis: { type: 'value' },
    series: [{ type: 'bar', data: [] }]
  })
})

onBeforeUnmount(() => {
  chartInstance?.dispose()
})
</script>

<template>
  <div ref="chartRef" style="width:100%;height:400px"></div>
</template>
```

---

### 通用图表模式

**首页统计**的 5 种图表：

| 图表 | 类型 | 数据接口 | 说明 |
|------|------|----------|------|
| 统计概览 | 数字卡片 (n-statistic) | `/home/stats/overview` | 设备总数、在线数、离线数、故障数 |
| 在线率趋势 | 折线图 line | `/home/stats/online-trend` | 近 7/30 天在线率 |
| 设备状态分布 | 饼图 pie | `/home/stats/status-distribution` | 各状态设备占比 |
| 组织设备排行 | 柱状图 bar | `/home/stats/org-ranking` | 各组织设备数量 TOP10 |
| 最新升级记录 | 表格 table | `/upgrade/record/list` | 最近 5 条升级记录 |

**通用 init 模式**：

```js
import * as echarts from 'echarts'

const chartRef = ref(null)
let chart = null

onMounted(() => {
  chart = echarts.init(chartRef.value)
  loadData()
})

function loadData() {
  $common.post('/home/stats/status-distribution').then(res => {
    chart.setOption({
      tooltip: { trigger: 'item', formatter: '{b}: {c} ({d}%)' },
      series: [{
        type: 'pie',
        radius: ['40%', '70%'],
        data: res.data.map(d => ({ name: d.name, value: d.count }))
      }]
    })
  })
}

onBeforeUnmount(() => chart?.dispose())
```

---

### 响应式适配

```js
// 跟随容器大小变化
import { useResizeObserver } from '@vueuse/core'

useResizeObserver(chartRef, () => chart?.resize())
```

---

### 授权 import

已在 `magic-import.js` 白名单中添加 `'echarts'`。动态 SFC 中直接 `import * as echarts from 'echarts'` 即可，无需额外配置。
