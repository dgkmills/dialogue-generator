<script setup>
defineProps({
  modelValue: { type: String, required: true },
})
defineEmits(['update:modelValue'])

const tabs = [
  { id: 'general', label: 'General' },
  { id: 'kohsel', label: 'Kohsel' },
  { id: 'custom', label: 'Custom Words' },
]
</script>

<template>
  <div class="flex gap-1 bg-gray-100 p-1 rounded-xl">
    <button
      v-for="tab in tabs"
      :key="tab.id"
      @click="$emit('update:modelValue', tab.id)"
      :class="[
        'flex-1 px-4 py-2.5 text-sm font-medium rounded-lg transition-all duration-200',
        modelValue === tab.id
          ? 'bg-white text-blue-700 shadow-sm'
          : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      ]"
    >
      {{ tab.label }}
    </button>
  </div>
</template>
