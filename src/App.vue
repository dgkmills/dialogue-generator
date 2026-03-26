<script setup>
import { ref, computed, watch } from 'vue'
import { useDialogue } from '@/composables/useDialogue'
import { usePractice } from '@/composables/usePractice'
import { GENERAL_TOPICS, KOHSEL_TOPICS, DIFFICULTY_LEVELS } from '@/data/topics'
import TopicTabs from '@/components/TopicTabs.vue'
import TopicChips from '@/components/TopicChips.vue'
import CustomWordsInput from '@/components/CustomWordsInput.vue'
import ScriptEditor from '@/components/ScriptEditor.vue'
import VoiceSelector from '@/components/VoiceSelector.vue'
import AudioPlayer from '@/components/AudioPlayer.vue'
import PracticeMode from '@/components/PracticeMode.vue'

const {
  script,
  audioUrl,
  audioSegments,
  history,
  loading,
  audioLoading,
  error,
  speakers,
  voiceSelections,
  generateScript,
  generateAudio,
  copyScript,
  restoreFromHistory,
  updateBestScore,
} = useDialogue()

const { practiceActive, endPractice, averageScore: practiceAvgScore } = usePractice()

const showPractice = ref(false)
const showConfirm = ref(false)
const activeTab = ref('general')
const selectedTopic = ref('')
const customWords = ref('')
const difficulty = ref('medium')
let autoPlayAudio = null // track the auto-play audio instance

const currentTopics = computed(() => {
  if (activeTab.value === 'general') return GENERAL_TOPICS
  if (activeTab.value === 'kohsel') return KOHSEL_TOPICS
  return []
})

const canGenerate = computed(() => {
  if (activeTab.value === 'custom') return customWords.value.trim().length > 0
  return selectedTopic.value.length > 0
})

// Auto-generate audio after script is generated, then auto-play and show practice
watch(script, async (newScript) => {
  // Always reset practice state when script changes
  stopAutoPlayAudio()
  endPractice()
  showPractice.value = false

  if (newScript && !audioUrl.value) {
    await generateAudio()
    if (audioUrl.value) {
      autoPlayAudio = new Audio(audioUrl.value)
      autoPlayAudio.play().catch(() => {})
    }
    showPractice.value = true
  }
})

function stopAutoPlayAudio() {
  if (autoPlayAudio) {
    autoPlayAudio.pause()
    autoPlayAudio.currentTime = 0
    autoPlayAudio = null
  }
}

function handleTabChange(tab) {
  activeTab.value = tab
  selectedTopic.value = ''
  customWords.value = ''
}

function handleGenerateClick() {
  if (script.value) {
    showConfirm.value = true
  } else {
    doGenerate()
  }
}

function doGenerate() {
  showConfirm.value = false
  showPractice.value = false
  generateScript(activeTab.value, selectedTopic.value, customWords.value, difficulty.value)
}

// Save best practice score for current script
watch(practiceAvgScore, (newScore) => {
  if (newScore > 0) updateBestScore(newScore)
})

function cancelGenerate() {
  showConfirm.value = false
}

function handleRestore(index) {
  showPractice.value = false
  restoreFromHistory(index)
  showPractice.value = true
}

function handleVoiceUpdate(speaker, voiceName) {
  voiceSelections.value = { ...voiceSelections.value, [speaker]: voiceName }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <!-- Header -->
    <header class="bg-white border-b border-gray-100">
      <div class="max-w-5xl mx-auto px-4 py-6">
        <h1 class="text-2xl font-bold text-gray-900">Dialogue Generator</h1>
        <p class="text-sm text-gray-500 mt-1">Generate conversational scripts with AI voices</p>
      </div>
    </header>

    <!-- Layout wrapper -->
    <div class="max-w-5xl mx-auto px-4 py-8 flex gap-6">

    <!-- Main content -->
    <main class="flex-1 min-w-0 space-y-6">
      <!-- Tab selector -->
      <TopicTabs :modelValue="activeTab" @update:modelValue="handleTabChange" />

      <!-- Topic chips or custom input -->
      <TopicChips
        v-if="activeTab !== 'custom'"
        :topics="currentTopics"
        v-model="selectedTopic"
      />
      <CustomWordsInput v-else v-model="customWords" />

      <!-- Difficulty selector -->
      <div class="flex items-center gap-2">
        <span class="text-xs font-medium text-gray-500">Difficulty:</span>
        <div class="flex gap-1">
          <button
            v-for="level in DIFFICULTY_LEVELS"
            :key="level.value"
            @click="difficulty = level.value"
            :title="level.description"
            :class="[
              'px-3 py-1 text-xs font-medium rounded-full border transition-all duration-200',
              difficulty === level.value
                ? level.value === 'easy' ? 'bg-emerald-500 text-white border-emerald-500'
                  : level.value === 'hard' ? 'bg-red-500 text-white border-red-500'
                  : 'bg-blue-500 text-white border-blue-500'
                : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            ]"
          >{{ level.label }}</button>
        </div>
      </div>

      <!-- Generate button -->
      <button
        @click="handleGenerateClick"
        :disabled="!canGenerate || loading || audioLoading"
        class="w-full py-3 px-6 bg-blue-600 text-white font-medium rounded-xl transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed hover:bg-blue-700 active:scale-[0.98]"
      >
        <span v-if="loading || audioLoading" class="flex items-center justify-center gap-2">
          <svg class="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" />
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          {{ audioLoading ? 'Generating Audio...' : 'Generating Script...' }}
        </span>
        <span v-else>Generate Script</span>
      </button>

      <!-- Confirm regenerate dialog -->
      <div v-if="showConfirm" class="bg-amber-50 border border-amber-200 rounded-xl p-4 space-y-3">
        <p class="text-sm text-amber-800">This will clear your current script and practice progress. Continue?</p>
        <div class="flex gap-3">
          <button @click="doGenerate" class="flex-1 py-2 px-4 bg-amber-500 text-white rounded-xl font-medium hover:bg-amber-600 transition-colors">Yes, generate new</button>
          <button @click="cancelGenerate" class="flex-1 py-2 px-4 border border-gray-200 text-gray-600 rounded-xl font-medium hover:bg-gray-50 transition-colors">Cancel</button>
        </div>
      </div>

      <!-- Script display (always visible when script exists) -->
      <ScriptEditor
        v-if="script"
        :script="script"
        @update:script="script = $event"
        @copy="copyScript"
      />

      <!-- Audio player -->
      <AudioPlayer v-if="audioUrl" :audioUrl="audioUrl" :loading="audioLoading" />

      <!-- Practice Mode (auto-shown after generation) -->
      <PracticeMode
        v-if="showPractice && script"
        :script="script"
        :speakers="speakers"
        :audioSegments="audioSegments"
        @close="showPractice = false"
        @practiceStart="stopAutoPlayAudio"
      />

      <!-- Error message -->
      <div
        v-if="error"
        class="px-4 py-3 rounded-xl text-sm"
        :class="error.includes('fallback') ? 'bg-amber-50 text-amber-700' : 'bg-red-50 text-red-600'"
      >
        {{ error }}
      </div>

      <!-- Mobile history (below content on small screens) -->
      <div v-if="history.length > 0" class="space-y-2 md:hidden">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Previous Scripts</h3>
        <div
          v-for="(entry, i) in history"
          :key="'m' + entry.timestamp"
          @click="handleRestore(i)"
          class="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all duration-200"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-xs font-medium text-gray-500">{{ entry.topic }}</span>
            <span class="text-xs text-gray-300">·</span>
            <span class="text-xs capitalize" :class="entry.difficulty === 'easy' ? 'text-emerald-500' : entry.difficulty === 'hard' ? 'text-red-500' : 'text-blue-500'">{{ entry.difficulty || 'medium' }}</span>
          </div>
          <p class="text-sm text-gray-600 truncate">{{ entry.script.split('\n')[0] }}</p>
          <div class="flex items-center justify-between mt-1.5">
            <span v-if="entry.topScore" class="text-xs font-semibold" :class="entry.topScore >= 80 ? 'text-emerald-600' : entry.topScore >= 50 ? 'text-amber-600' : 'text-red-500'">Best: {{ entry.topScore }}</span>
            <span v-else class="text-xs text-gray-400">No score yet</span>
            <span class="text-xs text-blue-500">Restore</span>
          </div>
        </div>
      </div>
    </main>

    <!-- Right sidebar: History -->
    <aside v-if="history.length > 0" class="w-64 shrink-0 hidden md:block">
      <div class="sticky top-8 space-y-2">
        <h3 class="text-xs font-semibold text-gray-400 uppercase tracking-wider">Previous Scripts</h3>
        <div
          v-for="(entry, i) in history"
          :key="entry.timestamp"
          @click="handleRestore(i)"
          class="bg-white border border-gray-200 rounded-xl p-3 cursor-pointer hover:border-blue-300 hover:shadow-sm transition-all duration-200"
        >
          <div class="flex items-center gap-1.5 mb-1">
            <span class="text-xs font-medium text-gray-500">{{ entry.topic }}</span>
            <span class="text-xs text-gray-300">·</span>
            <span class="text-xs capitalize" :class="entry.difficulty === 'easy' ? 'text-emerald-500' : entry.difficulty === 'hard' ? 'text-red-500' : 'text-blue-500'">{{ entry.difficulty || 'medium' }}</span>
          </div>
          <p class="text-sm text-gray-600 truncate">{{ entry.script.split('\n')[0] }}</p>
          <div class="flex items-center justify-between mt-1.5">
            <span v-if="entry.topScore" class="text-xs font-semibold" :class="entry.topScore >= 80 ? 'text-emerald-600' : entry.topScore >= 50 ? 'text-amber-600' : 'text-red-500'">Best: {{ entry.topScore }}</span>
            <span v-else class="text-xs text-gray-400">No score yet</span>
            <span class="text-xs text-blue-500">Restore</span>
          </div>
        </div>
      </div>
    </aside>

    </div><!-- end layout wrapper -->
  </div>
</template>
