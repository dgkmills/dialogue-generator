<script setup>
defineProps({
  topics: { type: Array, required: true },
  modelValue: { type: String, default: '' },
})
defineEmits(['update:modelValue'])
</script>

<template>
  <div class="flex flex-wrap gap-2">
    <button
      v-for="topic in topics"
      :key="topic"
      @click="$emit('update:modelValue', topic)"
      :class="[
        'px-4 py-2 text-sm font-medium rounded-full border transition-all duration-200',
        modelValue === topic
          ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
          : 'bg-white text-gray-700 border-gray-200 hover:border-blue-300 hover:text-blue-600'
      ]"
    >
      {{ topic }}
    </button>
  </div>
</template>
