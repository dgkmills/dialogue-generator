// Topic definitions for the Dialogue Generator

export const GENERAL_TOPICS = [
  'Technology',
  'Food',
  'Fun',
  'Travel',
  'Work',
  'Silly',
  'Knock-Knock Joke',
  'Dad Joke',
  'Expression',
  'Idiom',
  'Adage',
]

export const KOHSEL_TOPICS = [
  'HR',
  'Production',
  'Quality Control',
  'Accounting',
  'Safety',
  'Materials Purchasing',
  'Customer Service',
]

export const VOICES = [
  { name: 'Zephyr', gender: 'female' },
  { name: 'Leda', gender: 'female' },
  { name: 'Aoede', gender: 'female' },
  { name: 'Callirrhoe', gender: 'female' },
  { name: 'Autonoe', gender: 'female' },
  { name: 'Puck', gender: 'male' },
  { name: 'Charon', gender: 'male' },
  { name: 'Kore', gender: 'male' },
  { name: 'Fenrir', gender: 'male' },
  { name: 'Orus', gender: 'male' },
]

export const DEFAULT_VOICE = {
  Jane: 'Zephyr',
  Joe: 'Puck',
}

export const DIFFICULTY_LEVELS = [
  { value: 'easy', label: 'Easy', description: 'Short words, simple grammar' },
  { value: 'medium', label: 'Medium', description: 'Everyday conversation' },
  { value: 'hard', label: 'Hard', description: 'Advanced vocabulary & idioms' },
]
