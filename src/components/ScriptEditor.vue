<script setup>
import { ref } from 'vue'

const props = defineProps({
  script: { type: String, required: true },
})

const emit = defineEmits(['update:script', 'copy'])
const copied = ref(false)

function handleCopy() {
  emit('copy')
  copied.value = true
  setTimeout(() => (copied.value = false), 2000)
}
</script>

<template>
  <div class="space-y-2">
    <div class="flex items-center justify-between">
      <label class="block text-sm font-medium text-gray-700">Generated Script</label>
      <button
        @click="handleCopy"
        class="text-xs font-medium px-3 py-1.5 rounded-lg transition-colors"
        :class="copied ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'"
      >
        {{ copied ? '✓ Copied' : 'Copy' }}
      </button>
    </div>
    <textarea
      :value="script"
      @input="$emit('update:script', $event.target.value)"
      rows="8"
      class="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm font-mono leading-relaxed resize-y focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
    />
  </div>
</template>
