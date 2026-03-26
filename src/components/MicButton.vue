<script setup>
defineProps({
  listening: Boolean,
  disabled: Boolean,
})

defineEmits(['click'])
</script>

<template>
  <button
    @click="$emit('click')"
    :disabled="disabled"
    class="relative w-16 h-16 rounded-full flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
    :class="listening
      ? 'bg-red-500 text-white scale-110 shadow-lg shadow-red-200'
      : 'bg-blue-600 text-white hover:bg-blue-700 active:scale-95 shadow-md'
    "
  >
    <!-- Pulse ring when listening -->
    <span
      v-if="listening"
      class="absolute inset-0 rounded-full bg-red-400 animate-ping opacity-30"
    />

    <!-- Mic icon -->
    <svg class="w-7 h-7 relative z-10" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
      <path stroke-linecap="round" stroke-linejoin="round" d="M12 18.75a6 6 0 006-6v-1.5m-6 7.5a6 6 0 01-6-6v-1.5m6 7.5v3.75m-3.75 0h7.5M12 15.75a3 3 0 01-3-3V4.5a3 3 0 116 0v8.25a3 3 0 01-3 3z" />
    </svg>
  </button>
</template>
