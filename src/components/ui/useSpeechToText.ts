import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Dictation via the browser's built-in SpeechRecognition.
 *
 * No dependency and no API key: the recognition runs through the browser's own speech service,
 * which is why this costs nothing and needs no backend. The trade-off is support — Chrome and Edge
 * have it, Firefox does not — so `supported` is exposed and callers hide the button rather than
 * offering something that will not work.
 *
 * Results arrive in two kinds. Interim results update as the doctor is still speaking and are
 * shown greyed; final results are appended to the field. Committing interim text would leave
 * half-recognised words in the clinical record.
 */

/* The API is still vendor-prefixed and is not in the TS DOM lib. */
interface SpeechRecognitionAlternativeLike {
  transcript: string
}
interface SpeechRecognitionResultLike {
  isFinal: boolean
  0: SpeechRecognitionAlternativeLike
  length: number
}
interface SpeechRecognitionEventLike {
  resultIndex: number
  results: {
    length: number
    [index: number]: SpeechRecognitionResultLike
  }
}
interface SpeechRecognitionErrorEventLike {
  error: string
}
interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null
  onend: (() => void) | null
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as unknown as {
    SpeechRecognition?: SpeechRecognitionCtor
    webkitSpeechRecognition?: SpeechRecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export interface SpeechToText {
  supported: boolean
  listening: boolean
  /** Words recognised but not yet final — render greyed, never save. */
  interim: string
  error: string | null
  start: () => void
  stop: () => void
  toggle: () => void
}

export interface UseSpeechToTextOptions {
  /** Called with each finalised chunk of speech. */
  onResult: (text: string) => void
  /**
   * Indian English by default — it markedly improves recognition of Indian names and place names
   * over the generic en-US model, which is what this will mostly be transcribing.
   */
  lang?: string
}

function describeError(code: string): string {
  switch (code) {
    case 'not-allowed':
    case 'service-not-allowed':
      return 'Microphone access was blocked. Allow it in your browser address bar and try again.'
    case 'no-speech':
      return 'Nothing was heard. Try again, a little closer to the microphone.'
    case 'audio-capture':
      return 'No microphone was found.'
    case 'network':
      return 'Speech recognition needs an internet connection.'
    case 'aborted':
      return ''
    default:
      return `Dictation stopped (${code}).`
  }
}

export function useSpeechToText({
  onResult,
  lang = 'en-IN',
}: UseSpeechToTextOptions): SpeechToText {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)

  const recognitionRef = useRef<SpeechRecognitionLike | null>(null)
  // Held in a ref so restarting recognition does not need a new listener each render.
  const onResultRef = useRef(onResult)
  useEffect(() => {
    onResultRef.current = onResult
  }, [onResult])

  const supported = getRecognitionCtor() !== null

  useEffect(() => {
    const Ctor = getRecognitionCtor()
    if (!Ctor) return

    const recognition = new Ctor()
    recognition.lang = lang
    // Continuous so a doctor can dictate several sentences without re-pressing the button.
    recognition.continuous = true
    recognition.interimResults = true
    recognition.maxAlternatives = 1

    recognition.onresult = (event) => {
      let finalText = ''
      let interimText = ''
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i]
        const text = result[0].transcript
        if (result.isFinal) finalText += text
        else interimText += text
      }
      setInterim(interimText)
      if (finalText.trim()) {
        onResultRef.current(finalText.trim())
        setInterim('')
      }
    }

    recognition.onerror = (event) => {
      const message = describeError(event.error)
      if (message) setError(message)
      setListening(false)
      setInterim('')
    }

    recognition.onend = () => {
      setListening(false)
      setInterim('')
    }

    recognitionRef.current = recognition
    return () => {
      recognition.onresult = null
      recognition.onerror = null
      recognition.onend = null
      recognition.abort()
      recognitionRef.current = null
    }
  }, [lang])

  const start = useCallback(() => {
    const recognition = recognitionRef.current
    if (!recognition) return
    setError(null)
    try {
      recognition.start()
      setListening(true)
    } catch {
      // start() throws if it is already running — harmless, and the state is already correct.
    }
  }, [])

  const stop = useCallback(() => {
    recognitionRef.current?.stop()
    setListening(false)
  }, [])

  const toggle = useCallback(() => {
    if (listening) stop()
    else start()
  }, [listening, start, stop])

  return { supported, listening, interim, error, start, stop, toggle }
}
