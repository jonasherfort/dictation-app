"use client"

import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Settings, Mic, MicOff, Wand2, Copy, Trash2, Brain } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import { SystemPromptEditor } from "@/components/system-prompt-editor"
import { LLMConfig } from "@/components/llm-config"
import type SpeechRecognition from "speech-recognition"

interface Example {
  input: string
  output: string
}

interface LLMConfigType {
  provider: string
  model: string
  apiKey: string
}

export default function DictationApp() {
  const [isRecording, setIsRecording] = useState(false)
  const [rawTranscript, setRawTranscript] = useState("")
  const [polishedTranscript, setPolishedTranscript] = useState("")
  const [isPolishing, setIsPolishing] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showLLMConfig, setShowLLMConfig] = useState(false)
  const [transcriptionMode, setTranscriptionMode] = useState<"browser" | "llm">("llm")
  const [systemPrompt, setSystemPrompt] = useState(
    "Polish and improve the following transcription. Fix grammar, punctuation, and sentence structure while maintaining the original meaning and tone. Make it clear and professional:",
  )
  const [transcriptionPrompt, setTranscriptionPrompt] = useState(
    "Transcribe this audio recording accurately. Provide only the transcription without any additional commentary.",
  )
  const [examples, setExamples] = useState<Example[]>([])

  const [transcriptionConfig, setTranscriptionConfig] = useState<LLMConfigType>({
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
  })
  const [polishingConfig, setPolishingConfig] = useState<LLMConfigType>({
    provider: "openai",
    model: "gpt-4o",
    apiKey: "",
  })

  const recognitionRef = useRef<SpeechRecognition | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const { toast } = useToast()

  useEffect(() => {
    const savedTranscriptionConfig = localStorage.getItem("dictation-transcription-config")
    const savedPolishingConfig = localStorage.getItem("dictation-polishing-config")

    if (savedTranscriptionConfig) {
      setTranscriptionConfig(JSON.parse(savedTranscriptionConfig))
    }
    if (savedPolishingConfig) {
      setPolishingConfig(JSON.parse(savedPolishingConfig))
    }
  }, [])

  useEffect(() => {
    if (typeof window !== "undefined" && "webkitSpeechRecognition" in window) {
      const SpeechRecognition = window.webkitSpeechRecognition || window.SpeechRecognition
      recognitionRef.current = new SpeechRecognition()

      const recognition = recognitionRef.current
      recognition.continuous = true
      recognition.interimResults = true
      recognition.lang = "en-US"

      recognition.onresult = (event) => {
        let finalTranscript = ""
        let interimTranscript = ""

        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript
          if (event.results[i].isFinal) {
            finalTranscript += transcript
          } else {
            interimTranscript += transcript
          }
        }

        setRawTranscript((prev) => prev + finalTranscript)
      }

      recognition.onerror = (event) => {
        console.error("Speech recognition error:", event.error)
        toast({
          title: "Recognition Error",
          description: `Speech recognition failed: ${event.error}`,
          variant: "destructive",
        })
        setIsRecording(false)
      }

      recognition.onend = () => {
        setIsRecording(false)
      }
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop()
      }
    }
  }, [toast])

  const startRecording = async () => {
    if (transcriptionMode === "browser") {
      if (recognitionRef.current && !isRecording) {
        setIsRecording(true)
        recognitionRef.current.start()
        toast({
          title: "Recording Started",
          description: "Speak clearly into your microphone",
        })
      }
    } else {
      // LLM transcription mode
      if (!transcriptionConfig.apiKey) {
        toast({
          title: "Configuration Required",
          description: "Please configure your LLM settings first",
          variant: "destructive",
        })
        return
      }

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        audioChunksRef.current = []

        mediaRecorderRef.current = new MediaRecorder(stream)
        mediaRecorderRef.current.ondataavailable = (event) => {
          if (event.data.size > 0) {
            audioChunksRef.current.push(event.data)
          }
        }

        mediaRecorderRef.current.onstop = async () => {
          const audioBlob = new Blob(audioChunksRef.current, { type: "audio/webm" })
          await transcribeWithLLM(audioBlob)
          stream.getTracks().forEach((track) => track.stop())
        }

        mediaRecorderRef.current.start()
        setIsRecording(true)

        toast({
          title: "Recording Started",
          description: "Recording audio for LLM transcription",
        })
      } catch (error) {
        toast({
          title: "Recording Failed",
          description: "Could not access microphone",
          variant: "destructive",
        })
      }
    }
  }

  const stopRecording = () => {
    if (transcriptionMode === "browser") {
      if (recognitionRef.current && isRecording) {
        recognitionRef.current.stop()
        setIsRecording(false)
        toast({
          title: "Recording Stopped",
          description: "Transcription complete",
        })
      }
    } else {
      if (mediaRecorderRef.current && isRecording) {
        mediaRecorderRef.current.stop()
        setIsRecording(false)
        toast({
          title: "Recording Stopped",
          description: "Processing with LLM...",
        })
      }
    }
  }

  const transcribeWithLLM = async (audioBlob: Blob) => {
    setIsTranscribing(true)
    try {
      const formData = new FormData()
      formData.append("audio", audioBlob)
      formData.append("provider", transcriptionConfig.provider)
      formData.append("model", transcriptionConfig.model)
      formData.append("apiKey", transcriptionConfig.apiKey)
      formData.append("systemPrompt", transcriptionPrompt)

      const response = await fetch("/api/transcribe", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        throw new Error("Failed to transcribe audio")
      }

      const data = await response.json()
      setRawTranscript(data.transcription)

      toast({
        title: "Transcription Complete",
        description: "Audio has been transcribed successfully",
      })
    } catch (error) {
      console.error("Transcription error:", error)
      toast({
        title: "Transcription Failed",
        description: "Failed to transcribe audio. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsTranscribing(false)
    }
  }

  const polishTranscript = async () => {
    if (!rawTranscript.trim()) {
      toast({
        title: "No Content",
        description: "Please record some speech first",
        variant: "destructive",
      })
      return
    }

    setIsPolishing(true)
    try {
      const response = await fetch("/api/polish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          transcript: rawTranscript,
          systemPrompt: systemPrompt,
          examples: examples,
          provider: polishingConfig.provider,
          model: polishingConfig.model,
          apiKey: polishingConfig.apiKey,
        }),
      })

      if (!response.ok) {
        throw new Error("Failed to polish transcript")
      }

      const data = await response.json()
      setPolishedTranscript(data.polishedText)
      toast({
        title: "Polishing Complete",
        description: "Your transcript has been improved",
      })
    } catch (error) {
      console.error("Error polishing transcript:", error)
      toast({
        title: "Polishing Failed",
        description: "Failed to polish the transcript. Please try again.",
        variant: "destructive",
      })
    } finally {
      setIsPolishing(false)
    }
  }

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast({
        title: "Copied",
        description: "Text copied to clipboard",
      })
    } catch (error) {
      toast({
        title: "Copy Failed",
        description: "Failed to copy text to clipboard",
        variant: "destructive",
      })
    }
  }

  const clearAll = () => {
    setRawTranscript("")
    setPolishedTranscript("")
    toast({
      title: "Cleared",
      description: "All transcripts have been cleared",
    })
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold font-serif text-white">AI Dictation Studio</h1>
          <p className="text-slate-300">Record, transcribe, and polish your speech with AI</p>
        </div>

        {/* Controls */}
        <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Button
                  onClick={isRecording ? stopRecording : startRecording}
                  size="lg"
                  className={`w-16 h-16 rounded-full ${
                    isRecording
                      ? "bg-red-500 hover:bg-red-600 text-white animate-pulse"
                      : "bg-emerald-500 hover:bg-emerald-600 text-white"
                  }`}
                  disabled={isTranscribing}
                >
                  {isRecording ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}
                </Button>

                {isRecording && (
                  <Badge variant="destructive" className="animate-pulse">
                    Recording... ({transcriptionMode === "llm" ? "LLM" : "Browser"})
                  </Badge>
                )}

                {isTranscribing && (
                  <Badge variant="secondary" className="animate-pulse">
                    Transcribing with LLM...
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button onClick={polishTranscript} disabled={!rawTranscript.trim() || isPolishing} variant="outline">
                  <Wand2 className="w-4 h-4 mr-2" />
                  {isPolishing ? "Polishing..." : "Polish Text"}
                </Button>

                <Button onClick={() => setShowLLMConfig(!showLLMConfig)} variant="outline" size="icon">
                  <Brain className="w-4 h-4" />
                </Button>

                <Button onClick={() => setShowSettings(!showSettings)} variant="outline" size="icon">
                  <Settings className="w-4 h-4" />
                </Button>

                <Button onClick={clearAll} variant="outline" size="icon">
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {showLLMConfig && (
          <LLMConfig
            transcriptionConfig={transcriptionConfig}
            polishingConfig={polishingConfig}
            onTranscriptionConfigChange={setTranscriptionConfig}
            onPolishingConfigChange={setPolishingConfig}
            onClose={() => setShowLLMConfig(false)}
          />
        )}

        {/* System Prompt Editor */}
        {showSettings && (
          <SystemPromptEditor
            systemPrompt={systemPrompt}
            onSystemPromptChange={setSystemPrompt}
            examples={examples}
            onExamplesChange={setExamples}
            onClose={() => setShowSettings(false)}
            transcriptionMode={transcriptionMode}
            onTranscriptionModeChange={setTranscriptionMode}
          />
        )}

        {/* Transcripts */}
        <Tabs defaultValue="polished" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-800/50">
            <TabsTrigger value="polished">Polished Version</TabsTrigger>
            <TabsTrigger value="raw">Raw Transcription</TabsTrigger>
          </TabsList>

          <TabsContent value="polished" className="space-y-4">
            <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg text-white">Polished Version</CardTitle>
                <Button
                  onClick={() => copyToClipboard(polishedTranscript)}
                  disabled={!polishedTranscript.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={polishedTranscript}
                  onChange={(e) => setPolishedTranscript(e.target.value)}
                  placeholder="Click the record button and then 'Polish Text' to generate an improved version..."
                  className="min-h-[300px] resize-none bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="raw" className="space-y-4">
            <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-lg text-white">Raw Transcription</CardTitle>
                <Button
                  onClick={() => copyToClipboard(rawTranscript)}
                  disabled={!rawTranscript.trim()}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy
                </Button>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={rawTranscript}
                  onChange={(e) => setRawTranscript(e.target.value)}
                  placeholder="Your speech will appear here as you record..."
                  className="min-h-[300px] resize-none bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
                />
                <div className="mt-2 text-sm text-slate-400">
                  Words:{" "}
                  {
                    rawTranscript
                      .trim()
                      .split(/\s+/)
                      .filter((word) => word.length > 0).length
                  }
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
