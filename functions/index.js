const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const textToSpeech = require('@google-cloud/text-to-speech');

// Secret stored via: firebase functions:secrets:set GEMINI_API_KEY
const geminiApiKey = defineSecret('GEMINI_API_KEY');

const ttsClient = new textToSpeech.TextToSpeechClient();

// ─── CORS helper ───
function handleCors(req, res) {
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.set('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return true;
  }
  return false;
}

// ─── Voice mapping: speaker name → Cloud TTS voice ───
const VOICE_MAP = {
  // Female voices
  Zephyr: 'en-US-Neural2-F',
  Leda: 'en-US-Neural2-C',
  Aoede: 'en-US-Neural2-E',
  Callirrhoe: 'en-US-Neural2-G',
  Autonoe: 'en-US-Neural2-H',
  // Male voices
  Puck: 'en-US-Neural2-D',
  Charon: 'en-US-Neural2-A',
  Kore: 'en-US-Neural2-I',
  Fenrir: 'en-US-Neural2-J',
  Orus: 'en-US-Studio-Q',
};

// Default voice assignments for Jane and Joe
const DEFAULT_SPEAKER_VOICES = {
  Jane: 'Zephyr',
  Joe: 'Puck',
};

// ─── System prompts ───
const BASE_SYSTEM_PROMPT = 'You are a creative writer. Your task is to generate a brief, two-person dialogue script.';

const DIFFICULTY_INSTRUCTIONS = {
  easy: 'Use very simple vocabulary (A1-A2 level), short sentences of 5-8 words each, and basic grammar. Avoid idioms, phrasal verbs, or complex structures.',
  medium: 'Use everyday conversational English (B1-B2 level) with natural phrasing. Sentences can be 8-15 words. Some common expressions are OK.',
  hard: 'Use advanced vocabulary (C1-C2 level), complex sentence structures, idioms, phrasal verbs, and nuanced expressions. Sentences can be 10-20 words.',
};

function buildUserPrompt(category, topic, customWords, difficulty = 'medium') {
  const difficultyGuide = DIFFICULTY_INSTRUCTIONS[difficulty] || DIFFICULTY_INSTRUCTIONS.medium;
  const formatInstructions = `The script should have between 4 and 6 lines of dialogue. ${difficultyGuide} The output must be only the script and follow this format exactly, with each line of dialogue on a new line:
Jane: [dialogue]
Joe: [dialogue]
Do not include any other text, titles, introductions, or quotation marks.`;

  if (category === 'custom') {
    return `Write a short, simple, two-person dialogue between a man and a woman that incorporates the following words or concepts: "${customWords}". The speakers must be named 'Joe' and 'Jane'. ${formatInstructions}`;
  }

  if (category === 'kohsel') {
    return `Write a short, professional office conversation between two colleagues, 'Joe' and 'Jane', at a transformer manufacturing company. The conversation should be about the "${topic}" department. ${formatInstructions}`;
  }

  // Special topic types
  const specialPrompts = {
    Silly: `Write a short, nonsensical, and silly two-person dialogue. The speakers must be named 'Joe' and 'Jane'. ${formatInstructions}`,
    'Knock-Knock Joke': `Write a short knock-knock joke formatted as a two-person dialogue. The speakers must be named 'Joe' and 'Jane'. ${formatInstructions}`,
    'Dad Joke': `Write a short "dad joke" formatted as a two-person dialogue. One person tells the joke, the other groans or reacts. The speakers must be named 'Joe' and 'Jane'. ${formatInstructions}`,
    Expression: `Write a short, simple, two-person dialogue where one person (Jane) asks about a common expression, and the other person (Joe) explains what it means. ${formatInstructions}`,
    Idiom: `Write a short, simple, two-person dialogue where one person (Jane) asks about a common idiom, and the other person (Joe) explains what it means. ${formatInstructions}`,
    Adage: `Write a short, simple, two-person dialogue where one person (Jane) asks about a common adage, and the other person (Joe) explains what it means. ${formatInstructions}`,
  };

  if (specialPrompts[topic]) {
    return specialPrompts[topic];
  }

  // General topics (Technology, Food, Fun, Travel, Work)
  return `Write a short, simple, two-person dialogue between a man and a woman about the topic of "${topic}". The speakers must be named 'Joe' and 'Jane'. ${formatInstructions}`;
}

// ─── Generate Dialogue ───
exports.generateDialogue = onRequest(
  { secrets: [geminiApiKey] },
  async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const { category, topic, customWords, difficulty } = req.body;

      // Input validation
      const validCategories = ['general', 'kohsel', 'custom'];
      if (!category || !validCategories.includes(category)) {
        return res.status(400).json({ error: 'Invalid category. Must be: general, kohsel, or custom.' });
      }
      if (category === 'custom' && (!customWords || typeof customWords !== 'string' || customWords.trim().length === 0)) {
        return res.status(400).json({ error: 'Custom words are required for custom category.' });
      }
      if (category !== 'custom' && (!topic || typeof topic !== 'string')) {
        return res.status(400).json({ error: 'Topic is required for general/kohsel categories.' });
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: BASE_SYSTEM_PROMPT,
      });

      const userPrompt = buildUserPrompt(category, topic, customWords, difficulty);
      const result = await model.generateContent(userPrompt);
      const text = result.response.text().trim();

      return res.json({ script: text });
    } catch (error) {
      console.error('Dialogue generation error:', error);
      return res.status(500).json({ error: `Dialogue generation failed: ${error.message}` });
    }
  }
);

// ─── Generate Audio ───
exports.generateAudio = onRequest(
  { secrets: [geminiApiKey], timeoutSeconds: 120 },
  async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const { script, voiceSelections } = req.body;

    if (!script || typeof script !== 'string') {
        return res.status(400).json({ error: 'Script text is required.' });
      }

      // Parse script into lines with speaker names
      const lines = script.split('\n').filter(l => l.trim());
      const speakerPattern = /^(\w+):\s*(.+)$/;
      const audioSegments = [];

      for (const line of lines) {
        const match = line.match(speakerPattern);
        if (!match) continue;

        const [, speaker, dialogue] = match;

        // Determine voice: user selection → default mapping → fallback
        const voiceName = voiceSelections?.[speaker] || DEFAULT_SPEAKER_VOICES[speaker] || 'Zephyr';
        const ttsVoice = VOICE_MAP[voiceName] || 'en-US-Neural2-F';

        const [response] = await ttsClient.synthesizeSpeech({
          input: { text: dialogue },
          voice: {
            languageCode: 'en-US',
            name: ttsVoice,
            ssmlGender: ttsVoice.includes('-F') || ttsVoice.includes('-C') || ttsVoice.includes('-E') || ttsVoice.includes('-G') || ttsVoice.includes('-H') ? 'FEMALE' : 'MALE',
          },
          audioConfig: {
            audioEncoding: 'MP3',
            speakingRate: 0.95,
            pitch: 0.0,
          },
        });

        const buf = Buffer.from(response.audioContent);
        audioSegments.push({ speaker, dialogue, buffer: buf });
      }

      if (audioSegments.length === 0) {
        return res.status(400).json({ error: 'No valid dialogue lines found in script.' });
      }

      // Concatenate all MP3 segments into a single buffer
      const combined = Buffer.concat(audioSegments.map(s => s.buffer));
      const base64Audio = combined.toString('base64');

      // Also return per-line segments for practice mode
      const segments = audioSegments.map(s => ({
        speaker: s.speaker,
        dialogue: s.dialogue,
        audio: s.buffer.toString('base64'),
      }));

      return res.json({ audio: base64Audio, mimeType: 'audio/mpeg', segments });
    } catch (error) {
      console.error('Audio generation error:', error);
      return res.status(500).json({ error: `Audio generation failed: ${error.message}` });
    }
  }
);

// ─── Score Pronunciation ───
exports.scorePronunciation = onRequest(
  { secrets: [geminiApiKey] },
  async (req, res) => {
    if (handleCors(req, res)) return;

    try {
      const { targetText, userTranscript } = req.body;

      if (!targetText || typeof targetText !== 'string') {
        return res.status(400).json({ error: 'targetText is required.' });
      }
      if (!userTranscript || typeof userTranscript !== 'string') {
        return res.status(400).json({ error: 'userTranscript is required.' });
      }

      const genAI = new GoogleGenerativeAI(geminiApiKey.value());
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: `You are a friendly and encouraging ESL pronunciation coach. Your job is to evaluate how well a student pronounced a target English sentence. You will receive the target text and the student's speech-to-text transcript.

IMPORTANT: Speech-to-text transcription is imperfect. Focus ONLY on PHONETIC similarity — whether the student SAID the right sounds. DO NOT penalize for:
- Case differences ("true" vs "True" is identical)
- Missing punctuation or grammar marks ("lets" vs "let's", missing periods/commas/question marks)
- Homophones ("there"/"their"/"they're", "to"/"too"/"two")
- Minor filler words ("um", "uh")
- Contractions vs expanded forms ("let's" vs "lets" vs "let us")
- Articles or small connecting words that sound natural in speech

If the student said all the same words with the same meaning and sounds, that is a PERFECT 100 score. Only deduct points for clearly MISSING words or clearly WRONG words.

Return ONLY valid JSON with exactly these fields:
{"score": <number, must be a multiple of 5 from 0 to 100>, "feedback": "<brief encouraging feedback>"}

Scoring guide (use multiples of 5 only: 0, 5, 10, ... 95, 100):
- 100: Perfect — all words pronounced correctly
- 85-95: Excellent — nearly perfect, maybe one minor issue
- 70-80: Good — mostly correct but a few unclear words
- 50-65: Fair — some words unclear or missing
- 25-45: Needs practice — significant differences
- 0-20: Try again — very different from target`,
      });

      const prompt = `Target text: "${targetText}"\nStudent said: "${userTranscript}"`;
      const result = await model.generateContent(prompt);
      const responseText = result.response.text().trim();

      // Parse JSON from response (handle markdown code fences)
      const jsonStr = responseText.replace(/^```json?\s*/i, '').replace(/```\s*$/i, '').trim();
      const parsed = JSON.parse(jsonStr);

      // Round to nearest 5
      const raw = Math.max(0, Math.min(100, Math.round(Number(parsed.score) || 0)));
      const score = Math.round(raw / 5) * 5;
      const feedback = String(parsed.feedback || 'Keep practicing!');

      return res.json({ score, feedback });
    } catch (error) {
      console.error('Pronunciation scoring error:', error);

      // Fallback: simple word-match scoring
      try {
        const { targetText, userTranscript } = req.body;
        const targetWords = targetText.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const userWords = userTranscript.toLowerCase().replace(/[^\w\s]/g, '').split(/\s+/);
        const matched = targetWords.filter(w => userWords.includes(w)).length;
        const raw = Math.round((matched / Math.max(targetWords.length, 1)) * 100);
        const score = Math.round(raw / 5) * 5;
        const feedback = score >= 70 ? 'Good effort! Keep it up!' : score >= 40 ? 'Not bad — try again for a better score!' : 'Keep practicing — you\'ll get it!';
        return res.json({ score, feedback, fallback: true });
      } catch (fallbackError) {
        return res.status(500).json({ error: `Scoring failed: ${error.message}` });
      }
    }
  }
);
