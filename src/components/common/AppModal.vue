<script setup lang="ts">
defineProps<{
  title: string
  show: boolean
}>()

const emit = defineEmits<{
  close: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[100] flex items-center justify-center p-4"
    >
      <!-- オーバーレイ -->
      <div
        class="absolute inset-0 bg-black/50"
        @click="emit('close')"
      />
      <!-- モーダル本体 -->
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div class="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 class="text-xl font-bold text-gray-800">{{ title }}</h2>
          <button
            class="btn-touch w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-full text-gray-600 text-2xl"
            @click="emit('close')"
          >
            ×
          </button>
        </div>
        <div class="p-5">
          <slot />
        </div>
      </div>
    </div>
  </Teleport>
</template>
