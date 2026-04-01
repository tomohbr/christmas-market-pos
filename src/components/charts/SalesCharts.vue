<script setup lang="ts">
import { computed } from 'vue'
import { Bar, Doughnut, Line } from 'vue-chartjs'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js'

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  ArcElement, Title, Tooltip, Legend, Filler
)

const props = defineProps<{
  // 時間帯別
  hourlyData?: { hour: number; count: number; total: number }[]
  // 日別
  dailyData?: { date: string; total: number; orders: number }[]
  // 支払方法別
  paymentData?: Record<string, { count: number; total: number }>
  // 商品別（上位）
  productData?: { name: string; count: number; total: number }[]
  // 会場別
  venueData?: { name: string; total: number }[]
  // カテゴリ別
  categoryData?: { category: string; sales: number }[]
}>()

const paymentLabels: Record<string, string> = {
  cash: '現金', cashless: 'キャッシュレス', other: 'その他',
}

// 時間帯別バーチャート
const hourlyChartData = computed(() => {
  if (!props.hourlyData?.length) return null
  return {
    labels: props.hourlyData.map((h) => `${h.hour}時`),
    datasets: [
      {
        label: '注文数',
        data: props.hourlyData.map((h) => h.count),
        backgroundColor: 'rgba(59, 130, 246, 0.7)',
        borderRadius: 6,
        yAxisID: 'y',
      },
      {
        label: '売上(千円)',
        data: props.hourlyData.map((h) => Math.round(h.total / 1000)),
        backgroundColor: 'rgba(239, 68, 68, 0.3)',
        borderColor: 'rgba(239, 68, 68, 0.8)',
        type: 'line' as const,
        fill: true,
        tension: 0.3,
        yAxisID: 'y1',
      },
    ],
  }
})

const hourlyOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const, labels: { font: { size: 11 } } } },
  scales: {
    y: { beginAtZero: true, title: { display: true, text: '注文数' }, position: 'left' as const },
    y1: { beginAtZero: true, title: { display: true, text: '売上(千円)' }, position: 'right' as const, grid: { drawOnChartArea: false } },
  },
}

// 日別折れ線
const dailyChartData = computed(() => {
  if (!props.dailyData?.length) return null
  return {
    labels: props.dailyData.map((d) => {
      const dt = new Date(d.date)
      return `${dt.getMonth() + 1}/${dt.getDate()}`
    }),
    datasets: [
      {
        label: '売上(千円)',
        data: props.dailyData.map((d) => Math.round(d.total / 1000)),
        borderColor: 'rgba(16, 185, 129, 0.9)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        fill: true,
        tension: 0.3,
        pointRadius: 5,
        pointBackgroundColor: 'rgba(16, 185, 129, 1)',
      },
      {
        label: '注文数',
        data: props.dailyData.map((d) => d.orders),
        borderColor: 'rgba(99, 102, 241, 0.8)',
        backgroundColor: 'transparent',
        tension: 0.3,
        pointRadius: 4,
        yAxisID: 'y1',
      },
    ],
  }
})

const dailyOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { position: 'top' as const, labels: { font: { size: 11 } } } },
  scales: {
    y: { beginAtZero: true, title: { display: true, text: '売上(千円)' } },
    y1: { beginAtZero: true, title: { display: true, text: '注文数' }, position: 'right' as const, grid: { drawOnChartArea: false } },
  },
}

// 支払方法ドーナツ
const paymentChartData = computed(() => {
  if (!props.paymentData) return null
  const entries = Object.entries(props.paymentData)
  if (entries.length === 0) return null
  return {
    labels: entries.map(([k]) => paymentLabels[k] || k),
    datasets: [{
      data: entries.map(([, v]) => v.total),
      backgroundColor: ['rgba(59, 130, 246, 0.7)', 'rgba(168, 85, 247, 0.7)', 'rgba(156, 163, 175, 0.7)'],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  }
})

const doughnutOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { position: 'bottom' as const, labels: { font: { size: 12 } } },
  },
}

// 商品別横棒
const productChartData = computed(() => {
  if (!props.productData?.length) return null
  const top = props.productData.slice(0, 10)
  return {
    labels: top.map((p) => p.name.length > 12 ? p.name.slice(0, 12) + '…' : p.name),
    datasets: [{
      label: '売上',
      data: top.map((p) => p.total),
      backgroundColor: 'rgba(245, 158, 11, 0.7)',
      borderRadius: 4,
    }],
  }
})

const productOptions = {
  responsive: true,
  maintainAspectRatio: false,
  indexAxis: 'y' as const,
  plugins: { legend: { display: false } },
  scales: { x: { beginAtZero: true } },
}

// 会場別棒グラフ
const venueChartData = computed(() => {
  if (!props.venueData?.length) return null
  return {
    labels: props.venueData.map((v) => v.name),
    datasets: [{
      label: '売上',
      data: props.venueData.map((v) => v.total),
      backgroundColor: [
        'rgba(239, 68, 68, 0.7)',
        'rgba(59, 130, 246, 0.7)',
        'rgba(16, 185, 129, 0.7)',
        'rgba(245, 158, 11, 0.7)',
        'rgba(168, 85, 247, 0.7)',
      ],
      borderRadius: 6,
    }],
  }
})

const venueOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: { y: { beginAtZero: true } },
}

// カテゴリ別ドーナツ
const categoryChartData = computed(() => {
  if (!props.categoryData?.length) return null
  return {
    labels: props.categoryData.map((c) => c.category),
    datasets: [{
      data: props.categoryData.map((c) => c.sales),
      backgroundColor: ['rgba(249, 115, 22, 0.7)', 'rgba(59, 130, 246, 0.7)', 'rgba(16, 185, 129, 0.7)'],
      borderWidth: 2,
      borderColor: '#fff',
    }],
  }
})
</script>

<template>
  <div class="space-y-4">
    <!-- 日別推移 -->
    <div v-if="dailyChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 class="font-bold text-gray-800 mb-3 text-sm">日別売上推移</h3>
      <div class="h-64">
        <Line :data="dailyChartData" :options="dailyOptions" />
      </div>
    </div>

    <!-- 時間帯別 -->
    <div v-if="hourlyChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 class="font-bold text-gray-800 mb-3 text-sm">時間帯別（注文数 × 売上）</h3>
      <div class="h-64">
        <Bar :data="hourlyChartData" :options="hourlyOptions" />
      </div>
    </div>

    <!-- 2列レイアウト -->
    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <!-- 支払方法別 -->
      <div v-if="paymentChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">支払方法別</h3>
        <div class="h-48">
          <Doughnut :data="paymentChartData" :options="doughnutOptions" />
        </div>
      </div>

      <!-- カテゴリ別 -->
      <div v-if="categoryChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
        <h3 class="font-bold text-gray-800 mb-3 text-sm">カテゴリ別売上</h3>
        <div class="h-48">
          <Doughnut :data="categoryChartData" :options="doughnutOptions" />
        </div>
      </div>
    </div>

    <!-- 会場別 -->
    <div v-if="venueChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 class="font-bold text-gray-800 mb-3 text-sm">会場別売上</h3>
      <div class="h-52">
        <Bar :data="venueChartData" :options="venueOptions" />
      </div>
    </div>

    <!-- 商品別 -->
    <div v-if="productChartData" class="bg-white rounded-xl p-4 border border-gray-100 shadow-sm">
      <h3 class="font-bold text-gray-800 mb-3 text-sm">商品別売上 TOP10</h3>
      <div class="h-72">
        <Bar :data="productChartData" :options="productOptions" />
      </div>
    </div>
  </div>
</template>
