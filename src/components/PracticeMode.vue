<script setup>
import { usePractice } from '@/composables/usePractice'
import MicButton from '@/components/MicButton.vue'

const props = defineProps({
  script: String,
  speakers: Array,
  audioSegments: Array,
})

const emit = defineEmits(['close', 'practiceStart'])

const {
  practiceActive,
  practiceSpeaker,
  currentLineIndex,
  currentLine,
  parsedLines,
  scores,
  isListening,
  isScoring,
  isUserLine,
  isComplete,
  progress,
  averageScore,
  currentTranscript,
  practiceError,
  startPractice,
  endPractice,
  playPartnerLine,
  startListening,
  stopListening,
} = usePractice()

function handleStart(speaker) {
  emit('practiceStart')
  startPractice(speaker, props.script, props.audioSegments || [])
}

function handleClose() {
  endPractice()
  emit('close')
}

function handleMicClick() {
  if (isListening.value) {
    stopListening()
  } else {
    startListening()
  }
}

function diffWords(target, spoken) {
  if (!target || !spoken) return [{ text: spoken || '(no speech)', match: false }]
  const normalize = s => s.toLowerCase().replace(/[^\w\s]/g, '')
  const targetWords = normalize(target).split(/\s+/)
  const spokenWords = normalize(spoken).split(/\s+/)
  const targetSet = new Set(targetWords)
  return spoken.split(/\s+/).map(word => ({
    text: word,
    match: targetSet.has(normalize(word)),
  }))
}
</script>

<template>
  <div class="space-y-4">
    <!-- Speaker Selection (before practice starts) -->
    <div v-if="!practiceActive" class="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
      <h3 class="font-semibold text-gray-900">Choose Your Role</h3>
      <p class="text-sm text-gray-500">Select which speaker you'd like to practice as. The AI will play the other role.</p>
      <div class="flex gap-3">
        <button
          v-for="speaker in speakers"
          :key="speaker"
          @click="handleStart(speaker)"
          class="flex-1 py-3 px-4 rounded-xl font-medium transition-all duration-200 border-2 hover:shadow-md active:scale-[0.98]"
          :class="speaker === 'Jane'
            ? 'border-pink-300 bg-pink-50 text-pink-700 hover:bg-pink-100'
            : 'border-blue-300 bg-blue-50 text-blue-700 hover:bg-blue-100'
          "
        >
          Practice as {{ speaker }}
        </button>
      </div>
    </div>

    <!-- Practice In Progress -->
    <div v-else class="space-y-4">
      <!-- Header bar -->
      <div class="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
        <div>
          <span class="text-sm font-medium text-gray-500">Practicing as</span>
          <span
            class="ml-2 font-semibold"
            :class="practiceSpeaker === 'Jane' ? 'text-pink-600' : 'text-blue-600'"
          >{{ practiceSpeaker }}</span>
        </div>
        <div class="flex items-center gap-3">
          <div class="text-xs text-gray-400">{{ currentLineIndex + (isComplete ? 0 : 1) }} / {{ parsedLines.length }}</div>
          <!-- Progress bar -->
          <div class="w-24 h-1.5 bg-gray-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-blue-500 rounded-full transition-all duration-300"
              :style="{ width: progress + '%' }"
            />
          </div>
          <button
            @click="handleClose"
            class="text-gray-400 hover:text-gray-600 transition-colors p-1"
            title="Exit practice"
          >
            <svg class="w-5 h-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="2" stroke="currentColor">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Completion Summary -->
      <div v-if="isComplete" class="bg-white rounded-xl border border-gray-200 p-6 space-y-4 text-center">
        <div class="text-4xl">🎉</div>
        <h3 class="text-lg font-semibold text-gray-900">Practice Complete!</h3>
        <div
          class="text-5xl font-bold"
          :class="averageScore >= 80 ? 'text-emerald-600' : averageScore >= 50 ? 'text-amber-600' : 'text-red-500'"
        >{{ averageScore }}</div>
        <p class="text-sm text-gray-500">Average Score</p>

        <!-- Per-line scores with target vs heard -->
        <div class="space-y-3 text-left mt-4">
          <div
            v-for="(s, i) in scores"
            :key="i"
            class="rounded-xl border px-4 py-3 space-y-1.5"
            :class="s.score >= 80 ? 'bg-emerald-50 border-emerald-200' : s.score >= 50 ? 'bg-amber-50 border-amber-200' : 'bg-red-50 border-red-200'"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-semibold uppercase tracking-wider text-gray-400">
                {{ parsedLines[s.lineIndex]?.speaker }}
              </span>
              <span
                class="text-lg font-bold"
                :class="s.score >= 80 ? 'text-emerald-600' : s.score >= 50 ? 'text-amber-600' : 'text-red-500'"
              >{{ s.score }}</span>
            </div>
            <div class="text-sm">
              <p class="text-gray-500"><span class="font-medium text-gray-600">Target:</span> {{ parsedLines[s.lineIndex]?.dialogue }}</p>
              <p class="text-gray-500 mt-0.5">
                <span class="font-medium text-gray-600">You said:</span>
                <template v-for="(word, wi) in diffWords(parsedLines[s.lineIndex]?.dialogue, s.transcript)" :key="wi">
                  <span :class="word.match ? 'text-emerald-700' : 'text-red-600 font-semibold underline decoration-wavy decoration-red-300'">{{ word.text }} </span>
                </template>
              </p>
            </div>
          </div>
        </div>

        <div class="flex gap-3 pt-2">
          <button
            v-for="speaker in speakers"
            :key="speaker"
            @click="handleStart(speaker)"
            class="flex-1 py-2.5 px-4 rounded-xl font-medium transition-colors"
            :class="speaker === 'Jane'
              ? 'bg-pink-600 text-white hover:bg-pink-700'
              : 'bg-blue-600 text-white hover:bg-blue-700'"
          >Try as {{ speaker }}</button>
          <button
            @click="handleClose"
            class="py-2.5 px-4 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >Done</button>
        </div>
      </div>

      <!-- Active Line Display -->
      <div v-else class="space-y-4">
        <!-- Dialogue lines (scrolled context) -->
        <div class="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div class="divide-y divide-gray-100">
            <div
              v-for="(line, i) in parsedLines"
              :key="i"
              class="px-4 py-3 transition-all duration-200"
              :class="{
                'bg-blue-50': i === currentLineIndex,
                'opacity-40': i > currentLineIndex,
                'opacity-70': i < currentLineIndex,
              }"
            >
              <span
                class="text-xs font-semibold uppercase tracking-wider"
                :class="line.speaker === 'Jane' ? 'text-pink-500' : 'text-blue-500'"
              >{{ line.speaker }}</span>
              <p class="text-gray-800 mt-0.5" :class="{ 'font-medium': i === currentLineIndex }">
                {{ line.dialogue }}
              </p>
            </div>
          </div>
        </div>

        <!-- Partner line controls -->
        <div v-if="!isUserLine" class="bg-white rounded-xl border border-gray-200 p-5 text-center space-y-3">
          <p class="text-sm text-gray-500">🔊 Playing <strong>{{ currentLine?.speaker }}'s</strong> line...</p>
          <button
            @click="playPartnerLine"
            class="py-2.5 px-5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200 transition-colors"
          >🔊 Replay</button>
        </div>

        <!-- User line controls (conversational flow: mic only, no inline scoring) -->
        <div v-else class="bg-white rounded-xl border border-gray-200 p-5 space-y-4">
          <p class="text-sm text-gray-500 text-center">Your turn! Read the highlighted line.</p>

          <div class="flex flex-col items-center gap-3">
            <MicButton
              :listening="isListening"
              :disabled="isScoring"
              @click="handleMicClick"
            />
            <span v-if="isListening" class="text-sm text-red-500 animate-pulse">Listening...</span>
            <span v-if="isScoring" class="text-sm text-gray-400 animate-pulse">Moving on...</span>
          </div>

          <div v-if="currentTranscript" class="text-center">
            <p class="text-gray-700 italic text-sm">"{{ currentTranscript }}"</p>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="practiceError" class="px-4 py-3 bg-red-50 text-red-600 text-sm rounded-xl">
          {{ practiceError }}
        </div>
      </div>
    </div>
  </div>
</template>
