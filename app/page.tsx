"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Mic, MicOff, Wand2, Copy, Trash2, Brain, Timer, Square } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SystemPromptEditor } from "@/components/system-prompt-editor"
import { LLMConfig } from "@/components/llm-config"
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable"
import type SpeechRecognition from "speech-recognition"

type Mode = "browser" | "llm"

interface Example { input: string; output: string }
interface LLMConfigType { 
  provider: string; 
  model: string; 
  apiKey?: string;
  baseURL?: string;
  apiVersion?: string;
}

export default function DictationApp() {
  const [isRecording, setIsRecording] = useState(false)
  const [startedAt, setStartedAt] = useState<number | null>(null)
  const [rawTranscript, setRawTranscript] = useState("")
  const [polishedTranscript, setPolishedTranscript] = useState("")
  const [isPolishing, setIsPolishing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLLMConfig, setShowLLMConfig] = useState(false)
  const [transcriptionMode, setTranscriptionMode] = useState<Mode>("llm")
  const [systemPrompt, setSystemPrompt] = useState(
    "Polish and improve the following transcription. Fix grammar, punctuation, and sentence structure while maintaining the original meaning and tone. Make it clear and professional:"
  )
  const [transcriptionPrompt, setTranscriptionPrompt] = useState(
    "Transcribe this audio recording accurately. Provide only the transcription without any additional commentary."
  )
  const [examples, setExamples] = useState<Example[]>([])

  const [transcriptionConfig, setTranscriptionConfig] = useState<LLMConfigType>({ 
    provider: "openai", 
    model: "gpt-4o", 
    apiKey: "",
    baseURL: "",
    apiVersion: "",
  })
  const [polishingConfig, setPolishingConfig] = useState<LLMConfigType>({ 
    provider: "openai", 
    model: "gpt-4o", 
    apiKey: "",
    baseURL: "",
    apiVersion: "",
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const t = localStorage.getItem("dictation-transcription-config")
    const p = localStorage.getItem("dictation-polishing-config")
    if (t) setTranscriptionConfig(JSON.parse(t))
    if (p) setPolishingConfig(JSON.parse(p))
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognitionCtor = (window as any).webkitSpeechRecognition || (window as any).SpeechRecognition
      recognitionRef.current = new SpeechRecognitionCtor()
      const recognition = recognitionRef.current
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event: any) => {
        let finalTranscript = ""
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) finalTranscript += transcript
        }
        if (finalTranscript) {
          setRawTranscript(prev => (prev ? prev + " " : "") + finalTranscript.trim())
        }
      }

      recognition.onerror = (event: any) => {
        console.error("Speech recognition error:", event.error)
        toast({ title: "Recognition Error", description: String(event.error), variant: "destructive" })
        setIsRecording(false)
        setStartedAt(null)
      }
      recognition.onend = () => {
        setIsRecording(false)
        setStartedAt(null)
      }
    }
    return () => { recognitionRef.current?.stop() }
  }, [toast])

  const duration = useMemo(() => {
    if (!startedAt) return 0
    return Math.max(0, Math.floor((Date.now() - startedAt) / 1000))
  }, [startedAt, isRecording, rawTranscript])

  const mmss = useMemo(() => {
    const m = Math.floor(duration / 60).toString().padStart(2, "0")
    const s = (duration % 60).toString().padStart(2, "0")
    return `${m}:${s}`
  }, [duration])

  const startRecording = useCallback(async () => {
    if (isRecording) return
    if (transcriptionMode === "browser") {
      if (!recognitionRef.current) {
        toast({ title: "Unavailable", description: "Browser speech recognition not supported.", variant: "destructive" })
        return
      }
      setIsRecording(true)
      setStartedAt(Date.now())
      recognitionRef.current.start()
      toast({ title: "Recording", description: "Browser mode started." })
      return
    }
    if (!transcriptionConfig.apiKey) {
      toast({ title: "Configuration Required", description: "Set transcription API key.", variant: "destructive" })
      return
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      audioChunksRef.current = []
      mediaRecorderRef.current = new MediaRecorder(stream)
      mediaRecorderRef.current.ondataavailable = (e) => { if (e.data.size > 0) audioChunksRef.current.push(e.data) }
      mediaRecorderRef.current.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
        await transcribeWithLLM(audioBlob)
        stream.getTracks().forEach(t => t.stop())
      }
      mediaRecorderRef.current.start()
      setIsRecording(true)
      setStartedAt(Date.now())
      toast({ title: "Recording", description: "LLM mode started." })
    } catch {
      toast({ title: "Recording Failed", description: "Microphone access denied.", variant: "destructive" })
    }
  }, [isRecording, transcriptionMode, transcriptionConfig.apiKey, toast])

  const stopRecording = useCallback(() => {
    if (!isRecording) return
    if (transcriptionMode === "browser") {
      recognitionRef.current?.stop()
    } else {
      mediaRecorderRef.current?.stop()
    }
    setIsRecording(false)
    setStartedAt(null)
    toast({ title: "Stopped", description: transcriptionMode === "llm" ? "Processing…" : "Finalizing…" })
  }, [isRecording, transcriptionMode, toast])

  async function transcribeWithLLM(audioBlob: Blob) {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)
      formData.append("provider", transcriptionConfig.provider)
      formData.append("model", transcriptionConfig.model)
      formData.append("apiKey", transcriptionConfig.apiKey || "")
      if (transcriptionConfig.baseURL) formData.append("baseURL", transcriptionConfig.baseURL)
      if (transcriptionConfig.apiVersion) formData.append("apiVersion", transcriptionConfig.apiVersion)
      formData.append("systemPrompt", transcriptionPrompt)

      const res = await fetch("/api/transcribe", { method: "POST", body: formData })
      if (!res.ok) throw new Error("Transcription failed")
      const data = await res.json()
      setRawTranscript(data.transcription || "")
      toast({ title: "Transcribed", description: "Audio converted to text." })
    } catch (e) {
      console.error(e)
      toast({ title: "Transcription Failed", description: "Try again.", variant: "destructive" })
    } finally {
      setIsTranscribing(false)
    }
  }

  const polishTranscript = useCallback(async () => {
    if (!rawTranscript.trim()) {
      toast({ title: "No Content", description: "Record speech first.", variant: "destructive" })
      return
    }
    setIsPolishing(true)
    try {
      const res = await fetch("/api/polish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          transcript: rawTranscript,
          systemPrompt,
          examples,
          provider: polishingConfig.provider,
          model: polishingConfig.model,
          apiKey: polishingConfig.apiKey,
          baseURL: polishingConfig.baseURL,
          apiVersion: polishingConfig.apiVersion,
        }),
      })
      if (!res.ok) throw new Error("Polish failed")
      const data = await res.json()
      setPolishedTranscript(data.polishedText || "")
      toast({ title: "Polished", description: "Text improved." })
    } catch (e) {
      console.error(e)
      toast({ title: "Polish Failed", description: "Try again.", variant: "destructive" })
    } finally {
      setIsPolishing(false)
    }
  }, [rawTranscript, systemPrompt, examples, polishingConfig, toast])

  const copyToClipboard = useCallback(async (text: string) => {
    if (!text.trim()) return
    try {
      await navigator.clipboard.writeText(text)
      toast({ title: "Copied", description: "Text copied to clipboard." })
    } catch {
      toast({ title: "Copy Failed", description: "Clipboard unavailable.", variant: "destructive" })
    }
  }, [toast])

  const clearAll = useCallback(() => {
    setRawTranscript("")
    setPolishedTranscript("")
    toast({ title: "Cleared", description: "All text cleared." })
  }, [toast])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "enter") { e.preventDefault(); void polishTranscript(); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "c") {
        e.preventDefault()
        void copyToClipboard(polishedTranscript || rawTranscript)
      }
      if (e.key.toLowerCase() === "r" && !e.repeat) { e.preventDefault(); isRecording ? stopRecording() : void startRecording() }
      if (e.key === "Escape") { e.preventDefault(); stopRecording() }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [isRecording, polishedTranscript, rawTranscript, startRecording, stopRecording, copyToClipboard, polishTranscript])

  const wordCount = useMemo(() => rawTranscript.trim().split(/\s+/).filter(Boolean).length, [rawTranscript])

  return (
    <div className="min-h-screen bg-neutral-950 [background-image:radial-gradient(800px_420px_at_50%_-10%,rgba(255,255,255,.06),transparent)]">
      <header className="sticky top-0 z-40 border-b bg-[color-mix(in_oklab,var(--background),black_6%)]/70 backdrop-blur supports-[backdrop-filter]:backdrop-blur">
        <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-primary text-primary-foreground grid place-items-center">
              <Mic className="w-4 h-4" />
            </div>
            <div className="leading-tight">
              <div className="font-semibold">AI Dictation Studio</div>
              <div className="text-xs text-muted-foreground">Record • Transcribe • Polish</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="secondary">{transcriptionMode === "llm" ? "LLM mode" : "Browser mode"}</Badge>
            {isRecording && (<Badge variant="destructive" className="animate-pulse">REC {mmss}</Badge>)}
            {isTranscribing && (<Badge variant="secondary" className="animate-pulse">Transcribing…</Badge>)}
            <Button onClick={() => setShowLLMConfig(true)} variant="outline" size="sm" aria-label="LLM settings">
              <Brain className="w-4 h-4 mr-2" /> LLM
            </Button>
            <Button onClick={() => setShowSettings(true)} variant="outline" size="sm" aria-label="Advanced settings">
              <Settings className="w-4 h-4 mr-2" /> Settings
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 pt-6">
        <Card className="border border-input/60">
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  size="lg"
                  className={`h-12 px-5 ${isRecording ? "bg-red-600 hover:bg-red-700 text-white" : ""}`}
                  aria-pressed={isRecording}
                >
                  {isRecording ? <><Square className="w-4 h-4 mr-2" /> Stop</> : <><Mic className="w-4 h-4 mr-2" /> Record</>}
                </Button>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Timer className="w-4 h-4" />
                  <span>{mmss}</span>
                  <span className="mx-2">•</span>
                  <span>Words: {wordCount}</span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button onClick={polishTranscript} disabled={!rawTranscript.trim() || isPolishing} variant="outline">
                  <Wand2 className="w-4 h-4 mr-2" /> {isPolishing ? "Polishing…" : "Polish"}
                </Button>
                <Button onClick={() => copyToClipboard(polishedTranscript || rawTranscript)} variant="outline">
                  <Copy className="w-4 h-4 mr-2" /> Copy
                </Button>
                <Button onClick={clearAll} variant="outline">
                  <Trash2 className="w-4 h-4 mr-2" /> Clear
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <main className="mx-auto max-w-6xl px-4 py-6">
        <ResizablePanelGroup direction="horizontal" className="rounded-xl border">
          <ResizablePanel defaultSize={55} minSize={35}>
            <section aria-labelledby="polished-heading" className="h-full">
              <Card className="h-full rounded-none border-0">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle id="polished-heading" className="text-base">Polished</CardTitle>
                    <Tabs defaultValue="polished" className="w-auto">
                      <TabsList className="bg-transparent p-0">
                        <TabsTrigger value="polished" className="px-2">Polished</TabsTrigger>
                        <TabsTrigger value="raw" className="px-2" onClick={() => {}} />
                      </TabsList>
                    </Tabs>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={polishedTranscript}
                    onChange={(e) => setPolishedTranscript(e.target.value)}
                    placeholder="Polished text will appear here after processing…"
                    className="min-h-[420px] resize-none"
                    aria-label="Polished transcript"
                  />
                </CardContent>
              </Card>
            </section>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={45} minSize={25}>
            <section aria-labelledby="raw-heading" className="h-full">
              <Card className="h-full rounded-none border-0">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle id="raw-heading" className="text-base">Raw</CardTitle>
                    <Badge variant="outline">{isTranscribing ? "Transcribing…" : "Ready"}</Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <Textarea
                    value={rawTranscript}
                    onChange={(e) => setRawTranscript(e.target.value)}
                    placeholder="Your speech will appear here…"
                    className="min-h-[420px] resize-none"
                    aria-label="Raw transcript"
                    aria-live="polite"
                  />
                </CardContent>
              </Card>
            </section>
          </ResizablePanel>
        </ResizablePanelGroup>
      </main>

      {showLLMConfig && (
        <div className="mx-auto max-w-3xl px-4 pb-8">
          <LLMConfig
            transcriptionConfig={transcriptionConfig}
            polishingConfig={polishingConfig}
            onTranscriptionConfigChange={setTranscriptionConfig}
            onPolishingConfigChange={setPolishingConfig}
            onClose={() => setShowLLMConfig(false)}
          />
        </div>
      )}

      {showSettings && (
        <div className="mx-auto max-w-3xl px-4 pb-8">
          <SystemPromptEditor
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            examples={examples}
            onExamplesChange={setExamples}
            onClose={() => setShowSettings(false)}
            transcriptionMode={transcriptionMode}
            onTranscriptionModeChange={setTranscriptionMode}
          />
        </div>
      )}
    </div>
  )
}
