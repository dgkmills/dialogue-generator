<script setup>
import { VOICES } from '@/data/topics'

defineProps({
  speakers: { type: Array, required: true },
  voiceSelections: { type: Object, required: true },
})
defineEmits(['update:voiceSelections'])

const femaleVoices = VOICES.filter(v => v.gender === 'female')
const maleVoices = VOICES.filter(v => v.gender === 'male')
</script>

<template>
  <div class="space-y-3">
    <label class="block text-sm font-medium text-gray-700">Speaker Voices</label>
    <div class="grid gap-3 sm:grid-cols-2">
      <div
        v-for="speaker in speakers"
        :key="speaker"
        class="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3"
      >
        <span class="text-sm font-semibold text-gray-800 min-w-[50px]">{{ speaker }}</span>
        <select
          :value="voiceSelections[speaker]"
          @change="$emit('update:voiceSelections', speaker, $event.target.value)"
          class="flex-1 text-sm bg-white border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <optgroup label="Female">
            <option v-for="v in femaleVoices" :key="v.name" :value="v.name">{{ v.name }}</option>
          </optgroup>
          <optgroup label="Male">
            <option v-for="v in maleVoices" :key="v.name" :value="v.name">{{ v.name }}</option>
          </optgroup>
        </select>
      </div>
    </div>
  </div>
</template>
