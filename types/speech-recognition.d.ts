interface SpeechRecognition extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onerror: (event: SpeechRecognitionErrorEvent) => void
  onresult: (event: SpeechRecognitionEvent) => void
  onstart: (event: Event) => void
  onend: (event: Event) => void
}

interface SpeechRecognitionEvent extends Event {
  resultIndex: number
  results: SpeechRecognitionResultList
}

interface SpeechRecognitionResultList {
  length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionResult {
  length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
  isFinal: boolean
}

interface SpeechRecognitionAlternative {
  transcript: string
  confidence: number
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string
  message: string
}

interface Window {
  SpeechRecognition: any
  webkitSpeechRecognition: any
}
