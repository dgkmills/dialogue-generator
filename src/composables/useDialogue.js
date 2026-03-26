import { ref, computed } from 'vue'
import { callGenerateDialogue, callGenerateAudio } from '@/firebase'
import { DEFAULT_VOICE } from '@/data/topics'

const script = ref('')
const audioUrl = ref('')
const audioSegments = ref([])
const loading = ref(false)
const audioLoading = ref(false)
const error = ref('')
const voiceSelections = ref({})
const history = ref([]) // { script, audioUrl, audioSegments, timestamp, topic, difficulty, topScore }
const bestScore = ref(0) // best practice score for current script
const currentTopic = ref('') // track topic for history
const currentDifficulty = ref('medium') // track difficulty for history

// Parse speakers from script text
const speakers = computed(() => {
  if (!script.value) return []
  const pattern = /^(\w+):/gm
  const found = new Set()
  let match
  while ((match = pattern.exec(script.value)) !== null) {
    found.add(match[1])
  }
  return [...found]
})

// Initialize voice selections when speakers change
function initVoiceSelections() {
  const selections = {}
  for (const speaker of speakers.value) {
    selections[speaker] = voiceSelections.value[speaker] || DEFAULT_VOICE[speaker] || 'Zephyr'
  }
  voiceSelections.value = selections
}

export function useDialogue() {
  async function generateScript(category, topic, customWords, difficulty = 'medium') {
    loading.value = true
    error.value = ''

    // Save current to history before clearing
    if (script.value) {
      // Remove existing entry for this script if already in history (from live save)
      const filtered = history.value.filter(h => h.script !== script.value)
      history.value = [
        { script: script.value, audioUrl: audioUrl.value, audioSegments: [...audioSegments.value], timestamp: Date.now(), topic: currentTopic.value || topic || 'Custom', difficulty: currentDifficulty.value || difficulty, topScore: bestScore.value || null },
        ...filtered,
      ].slice(0, 5)
    }

    script.value = ''
    audioUrl.value = ''
    audioSegments.value = []
    bestScore.value = 0
    currentTopic.value = topic || 'Custom'
    currentDifficulty.value = difficulty

    try {
      const result = await callGenerateDialogue({ category, topic, customWords, difficulty })
      script.value = result.data.script
      initVoiceSelections()
    } catch (err) {
      console.error('Generate script error:', err)
      error.value = err.message || 'Failed to generate dialogue. Please try again.'
    } finally {
      loading.value = false
    }
  }

  async function generateAudio() {
    if (!script.value) return
    audioLoading.value = true
    error.value = ''

    // Revoke previous audio URL
    if (audioUrl.value) {
      URL.revokeObjectURL(audioUrl.value)
      audioUrl.value = ''
    }

    try {
      const result = await callGenerateAudio({
        script: script.value,
        voiceSelections: voiceSelections.value,
      })

      const { audio, mimeType, segments } = result.data

      // Store per-line segments for practice mode
      if (segments) {
        audioSegments.value = segments.map(seg => {
          const bin = atob(seg.audio)
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const blob = new Blob([bytes], { type: 'audio/mpeg' })
          return { speaker: seg.speaker, dialogue: seg.dialogue, url: URL.createObjectURL(blob) }
        })
      }

      const binaryStr = atob(audio)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }
      const blob = new Blob([bytes], { type: mimeType })
      audioUrl.value = URL.createObjectURL(blob)
    } catch (err) {
      console.error('Generate audio error:', err)
      // Fallback to browser speech synthesis
      if ('speechSynthesis' in window) {
        fallbackTTS()
      } else {
        error.value = err.message || 'Failed to generate audio. Please try again.'
      }
    } finally {
      audioLoading.value = false
    }
  }

  function fallbackTTS() {
    if (!script.value) return
    window.speechSynthesis.cancel()

    const lines = script.value.split('\n').filter(l => l.trim())
    const speakerPattern = /^(\w+):\s*(.+)$/

    let delay = 0
    for (const line of lines) {
      const match = line.match(speakerPattern)
      if (!match) continue
      const [, speaker, dialogue] = match

      const utterance = new SpeechSynthesisUtterance(dialogue)
      utterance.rate = 0.9
      utterance.lang = 'en-US'

      // Use different pitch for different speakers
      const voiceName = voiceSelections.value[speaker] || DEFAULT_VOICE[speaker]
      const isFemale = ['Zephyr', 'Leda', 'Aoede', 'Callirrhoe', 'Autonoe'].includes(voiceName)
      utterance.pitch = isFemale ? 1.2 : 0.8

      setTimeout(() => window.speechSynthesis.speak(utterance), delay)
      delay += 2500
    }

    error.value = 'Using browser voices as fallback (Cloud TTS unavailable).'
  }

  function copyScript() {
    if (script.value) {
      navigator.clipboard.writeText(script.value)
    }
  }

  function restoreFromHistory(index) {
    const entry = history.value[index]
    if (!entry) return
    script.value = entry.script
    audioUrl.value = entry.audioUrl
    audioSegments.value = entry.audioSegments
    bestScore.value = entry.topScore || 0
    currentTopic.value = entry.topic || ''
    currentDifficulty.value = entry.difficulty || 'medium'
    initVoiceSelections()
    // Remove from history
    history.value = history.value.filter((_, i) => i !== index)
  }

  function updateBestScore(score) {
    if (score > bestScore.value) bestScore.value = score
    // Immediately save/update current script in history
    if (script.value) {
      const existingIdx = history.value.findIndex(h => h.script === script.value)
      if (existingIdx >= 0) {
        // Update existing entry
        const entry = history.value[existingIdx]
        if (!entry.topScore || bestScore.value > entry.topScore) {
          entry.topScore = bestScore.value
        }
        // Move to top
        history.value = [
          entry,
          ...history.value.filter((_, i) => i !== existingIdx),
        ]
      } else {
        // Add new entry
        history.value = [
          { script: script.value, audioUrl: audioUrl.value, audioSegments: [...audioSegments.value], timestamp: Date.now(), topic: currentTopic.value || 'Custom', difficulty: currentDifficulty.value || 'medium', topScore: bestScore.value },
          ...history.value,
        ].slice(0, 5)
      }
    }
  }

  return {
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
  }
}
