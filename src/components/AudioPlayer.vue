<script setup>
import { ref } from 'vue'

const props = defineProps({
  audioUrl: { type: String, default: '' },
  loading: { type: Boolean, default: false },
})

const audioRef = ref(null)

function download() {
  if (!props.audioUrl) return
  const link = document.createElement('a')
  link.href = props.audioUrl
  link.download = 'dialogue.mp3'
  link.click()
}
</script>

<template>
  <div class="space-y-3">
    <div v-if="loading" class="flex items-center gap-3 text-sm text-gray-500 py-4">
      <svg class="animate-spin h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
      </svg>
      Generating audio...
    </div>

    <div v-else-if="audioUrl" class="space-y-3">
      <audio ref="audioRef" :src="audioUrl" controls class="w-full rounded-lg" />
      <button
        @click="download"
        class="text-xs font-medium px-3 py-1.5 bg-gray-100 text-gray-600 hover:bg-gray-200 rounded-lg transition-colors"
      >
        ↓ Download
      </button>
    </div>
  </div>
</template>
