import { ref, computed } from 'vue'
import { callScorePronunciation } from '@/firebase'

const practiceActive = ref(false)
const practiceSpeaker = ref('')
const currentLineIndex = ref(0)
const scores = ref([])
const isListening = ref(false)
const isScoring = ref(false)
const currentTranscript = ref('')
const currentFeedback = ref(null) // { score, feedback }
const practiceError = ref('')

// Parsed lines from the dialogue script
const parsedLines = ref([])

function parseScript(scriptText) {
  const lines = scriptText.split('\n').filter(l => l.trim())
  const pattern = /^(\w+):\s*(.+)$/
  return lines
    .map(line => {
      const match = line.match(pattern)
      if (!match) return null
      return { speaker: match[1], dialogue: match[2].trim() }
    })
    .filter(Boolean)
}

const currentLine = computed(() => parsedLines.value[currentLineIndex.value] || null)
const isUserLine = computed(() => currentLine.value?.speaker === practiceSpeaker.value)
const isComplete = computed(() => currentLineIndex.value >= parsedLines.value.length)
const progress = computed(() => {
  if (parsedLines.value.length === 0) return 0
  return Math.round((currentLineIndex.value / parsedLines.value.length) * 100)
})

const averageScore = computed(() => {
  if (scores.value.length === 0) return 0
  const sum = scores.value.reduce((a, b) => a + b.score, 0)
  return Math.round(sum / scores.value.length)
})

// Audio/recognition instances
let recognition = null
let currentAudio = null

function getSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
  if (!SpeechRecognition) return null
  const rec = new SpeechRecognition()
  rec.continuous = false
  rec.interimResults = false
  rec.lang = 'en-US'
  return rec
}

export function usePractice() {
  let audioSegmentsData = []

  function startPractice(speaker, scriptText, segments = []) {
    audioSegmentsData = segments
    parsedLines.value = parseScript(scriptText)
    practiceSpeaker.value = speaker
    currentLineIndex.value = 0
    scores.value = []
    currentTranscript.value = ''
    currentFeedback.value = null
    practiceError.value = ''
    practiceActive.value = true

    // Auto-start: play partner line or start mic for user line
    if (parsedLines.value.length > 0) {
      if (parsedLines.value[0].speaker !== speaker) {
        playPartnerLine()
      } else {
        setTimeout(() => startListening(), 500)
      }
    }
  }

  function endPractice() {
    stopListening()
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    window.speechSynthesis?.cancel()
    practiceActive.value = false
    currentLineIndex.value = 0
    parsedLines.value = []
    currentTranscript.value = ''
    currentFeedback.value = null
  }

  function playPartnerLine() {
    const line = currentLine.value
    if (!line || line.speaker === practiceSpeaker.value) return

    // Stop any currently playing audio
    if (currentAudio) {
      currentAudio.pause()
      currentAudio = null
    }
    window.speechSynthesis?.cancel()

    // Try to find matching Cloud TTS segment
    const segment = audioSegmentsData[currentLineIndex.value]
    if (segment && segment.url) {
      currentAudio = new Audio(segment.url)
      currentAudio.onended = () => autoAdvanceAfterPartner()
      currentAudio.play().catch(() => {
        fallbackSpeech(line)
        // fallback doesn't fire onended, so advance after delay
        setTimeout(() => autoAdvanceAfterPartner(), 3000)
      })
      return
    }

    // Fallback to browser speechSynthesis
    fallbackSpeech(line)
    setTimeout(() => autoAdvanceAfterPartner(), 3000)
  }

  function autoAdvanceAfterPartner() {
    // After partner line finishes playing, move to next line
    currentLineIndex.value++
    if (!isComplete.value && currentLine.value) {
      if (currentLine.value.speaker === practiceSpeaker.value) {
        setTimeout(() => startListening(), 300)
      } else {
        setTimeout(() => playPartnerLine(), 300)
      }
    }
  }

  function fallbackSpeech(line) {
    if (!('speechSynthesis' in window)) return
    const utterance = new SpeechSynthesisUtterance(line.dialogue)
    utterance.rate = 0.9
    utterance.lang = 'en-US'
    utterance.pitch = line.speaker === 'Jane' ? 1.2 : 0.8
    window.speechSynthesis.speak(utterance)
  }

  function startListening() {
    if (isListening.value) return

    practiceError.value = ''
    currentTranscript.value = ''
    currentFeedback.value = null

    recognition = getSpeechRecognition()
    if (!recognition) {
      practiceError.value = 'Speech recognition is not supported in this browser. Try Chrome or Edge.'
      return
    }

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript
      currentTranscript.value = transcript
      isListening.value = false
      submitAttempt(transcript)
    }

    recognition.onerror = (event) => {
      isListening.value = false
      if (event.error === 'no-speech') {
        practiceError.value = 'No speech detected. Try again.'
      } else if (event.error === 'not-allowed') {
        practiceError.value = 'Microphone access denied. Please allow microphone access and try again.'
      } else {
        practiceError.value = `Speech recognition error: ${event.error}`
      }
    }

    recognition.onend = () => {
      isListening.value = false
    }

    try {
      recognition.start()
      isListening.value = true
    } catch (err) {
      practiceError.value = 'Could not start speech recognition. Please try again.'
      isListening.value = false
    }
  }

  function stopListening() {
    if (recognition) {
      try { recognition.abort() } catch (e) { /* ignore */ }
      recognition = null
    }
    isListening.value = false
  }

  async function submitAttempt(transcript) {
    const line = currentLine.value
    if (!line) return

    const lineIdx = currentLineIndex.value
    isScoring.value = true
    practiceError.value = ''

    // Score in background — immediately advance to next line
    const scoringPromise = (async () => {
      try {
        const result = await callScorePronunciation({
          targetText: line.dialogue,
          userTranscript: transcript,
        })
        scores.value = [...scores.value, { lineIndex: lineIdx, transcript, ...result.data }]
      } catch (err) {
        const targetWords = line.dialogue.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
        const userWords = transcript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/)
        const matched = targetWords.filter(w => userWords.includes(w)).length
        const score = Math.round((matched / Math.max(targetWords.length, 1)) * 100)
        const feedback = score >= 70 ? 'Good effort!' : score >= 40 ? 'Not bad — try again!' : 'Keep practicing!'
        scores.value = [...scores.value, { lineIndex: lineIdx, transcript, score, feedback, fallback: true }]
      }
    })()

    // Auto-advance to next line immediately
    currentTranscript.value = ''
    currentFeedback.value = null
    practiceError.value = ''
    currentLineIndex.value++
    isScoring.value = false

    if (!isComplete.value && currentLine.value) {
      if (currentLine.value.speaker !== practiceSpeaker.value) {
        // Partner line — play it, then auto-start mic for the next user line
        setTimeout(() => playPartnerLine(), 300)
      } else {
        // User line — auto-start mic
        setTimeout(() => startListening(), 300)
      }
    }

    // Wait for scoring to finish (for completion summary)
    await scoringPromise
  }

  function nextLine() {
    currentTranscript.value = ''
    currentFeedback.value = null
    practiceError.value = ''
    currentLineIndex.value++

    if (!isComplete.value && currentLine.value) {
      if (currentLine.value.speaker !== practiceSpeaker.value) {
        setTimeout(() => playPartnerLine(), 300)
      } else {
        setTimeout(() => startListening(), 300)
      }
    }
  }

  function retryLine() {
    currentTranscript.value = ''
    currentFeedback.value = null
    practiceError.value = ''
    startListening()
  }

  return {
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
    currentFeedback,
    practiceError,
    startPractice,
    endPractice,
    playPartnerLine,
    startListening,
    stopListening,
    nextLine,
    retryLine,
  }
}
