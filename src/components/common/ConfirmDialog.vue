<script setup lang="ts">
defineProps<{
  show: boolean
  title: string
  message: string
  confirmLabel?: string
  confirmClass?: string
}>()

const emit = defineEmits<{
  confirm: []
  cancel: []
}>()
</script>

<template>
  <Teleport to="body">
    <div
      v-if="show"
      class="fixed inset-0 z-[110] flex items-center justify-center p-4"
    >
      <div class="absolute inset-0 bg-black/50" @click="emit('cancel')" />
      <div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <h3 class="text-xl font-bold text-gray-800 mb-2">{{ title }}</h3>
        <p class="text-gray-600 mb-6">{{ message }}</p>
        <div class="flex gap-3">
          <button
            class="btn-touch flex-1 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl"
            @click="emit('cancel')"
          >
            いいえ
          </button>
          <button
            :class="[
              'btn-touch flex-1 rounded-xl text-white',
              confirmClass || 'bg-red-500 hover:bg-red-600',
            ]"
            @click="emit('confirm')"
          >
            {{ confirmLabel || 'はい' }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
