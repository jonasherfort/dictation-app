"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import { Button } from "@/components/ui/button"
import { X, RotateCcw, Plus, Trash2, Brain, Cpu } from "lucide-react"

interface Example {
  input: string
  output: string
}

interface SystemPromptEditorProps {
  systemPrompt: string
  onSystemPromptChange: (prompt: string) => void
  examples: Example[]
  onExamplesChange: (examples: Example[]) => void
  onClose: () => void
  transcriptionMode: "browser" | "llm"
  onTranscriptionModeChange: (mode: "browser" | "llm") => void
}

const DEFAULT_PROMPTS = [
  {
    name: "Professional Polish",
    prompt:
      "Polish and improve the following transcription. Fix grammar, punctuation, and sentence structure while maintaining the original meaning and tone. Make it clear and professional:",
  },
  {
    name: "Casual Cleanup",
    prompt:
      "Clean up this transcription by fixing obvious errors and improving readability, but keep the casual, conversational tone:",
  },
  {
    name: "Meeting Notes",
    prompt: "Convert this transcription into well-structured meeting notes with clear bullet points and action items:",
  },
  {
    name: "Email Draft",
    prompt: "Transform this transcription into a professional email format with proper greeting, body, and closing:",
  },
]

export function SystemPromptEditor({
  systemPrompt,
  onSystemPromptChange,
  examples,
  onExamplesChange,
  onClose,
  transcriptionMode,
  onTranscriptionModeChange,
}: SystemPromptEditorProps) {
  const resetToDefault = () => {
    onSystemPromptChange(DEFAULT_PROMPTS[0].prompt)
  }

  const addExample = () => {
    onExamplesChange([...examples, { input: "", output: "" }])
  }

  const updateExample = (index: number, field: "input" | "output", value: string) => {
    const newExamples = [...examples]
    newExamples[index][field] = value
    onExamplesChange(newExamples)
  }

  const removeExample = (index: number) => {
    onExamplesChange(examples.filter((_, i) => i !== index))
  }

  return (
    <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-lg text-white">Advanced Settings</CardTitle>
        <Button onClick={onClose} variant="outline" size="sm">
          <X className="w-4 h-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <div>
          <label className="text-sm font-medium mb-3 block text-white">Transcription Mode</label>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => onTranscriptionModeChange("llm")}
              variant={transcriptionMode === "llm" ? "default" : "outline"}
              className="flex items-center gap-2 p-4 h-auto"
            >
              <Brain className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium text-sm">LLM Mode</div>
                <div className="text-xs opacity-70">AI-powered</div>
              </div>
            </Button>
            <Button
              onClick={() => onTranscriptionModeChange("browser")}
              variant={transcriptionMode === "browser" ? "default" : "outline"}
              className="flex items-center gap-2 p-4 h-auto"
            >
              <Cpu className="w-5 h-5" />
              <div className="text-left">
                <div className="font-medium text-sm">Browser Mode</div>
                <div className="text-xs opacity-70">Built-in</div>
              </div>
            </Button>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block text-white">Custom System Prompt</label>
          <Textarea
            value={systemPrompt}
            onChange={(e) => onSystemPromptChange(e.target.value)}
            placeholder="Enter your custom system prompt..."
            className="min-h-[120px] bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
          />
        </div>

        <div className="flex items-center gap-2">
          <Button onClick={resetToDefault} variant="outline" size="sm">
            <RotateCcw className="w-4 h-4 mr-2" />
            Reset to Default
          </Button>
        </div>

        <div>
          <label className="text-sm font-medium mb-2 block text-white">Quick Presets</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-w-full">
            {DEFAULT_PROMPTS.map((preset, index) => (
              <Button
                key={index}
                onClick={() => onSystemPromptChange(preset.prompt)}
                variant="outline"
                size="sm"
                className="justify-start text-left h-auto p-3 border-slate-600 hover:bg-slate-700 min-h-[4rem] overflow-hidden"
              >
                <div className="w-full overflow-hidden">
                  <div className="font-medium text-white truncate">{preset.name}</div>
                  <div className="text-xs text-slate-400 mt-1 line-clamp-2 overflow-hidden">
                    {preset.prompt.substring(0, 60)}...
                  </div>
                </div>
              </Button>
            ))}
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-3">
            <label className="text-sm font-medium text-white">Few-Shot Examples</label>
            <Button onClick={addExample} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-2" />
              Add Example
            </Button>
          </div>
          <p className="text-xs text-slate-400 mb-4">
            Provide examples of input transcriptions and desired outputs to improve AI performance.
          </p>

          <div className="space-y-4">
            {examples.map((example, index) => (
              <Card key={index} className="border-slate-600 bg-slate-900/30">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">Example {index + 1}</span>
                    <Button onClick={() => removeExample(index)} variant="outline" size="sm" className="h-8 w-8 p-0">
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Input (Raw Transcription)</label>
                    <Textarea
                      value={example.input}
                      onChange={(e) => updateExample(index, "input", e.target.value)}
                      placeholder="Enter example raw transcription..."
                      className="min-h-[80px] bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                    />
                  </div>

                  <div>
                    <label className="text-xs text-slate-400 mb-1 block">Output (Desired Polish)</label>
                    <Textarea
                      value={example.output}
                      onChange={(e) => updateExample(index, "output", e.target.value)}
                      placeholder="Enter desired polished output..."
                      className="min-h-[80px] bg-slate-800/50 border-slate-600 text-white placeholder:text-slate-500 text-sm"
                    />
                  </div>
                </CardContent>
              </Card>
            ))}

            {examples.length === 0 && (
              <div className="text-center py-8 text-slate-400">
                <p className="text-sm">No examples added yet.</p>
                <p className="text-xs mt-1">Add examples to improve AI polishing accuracy.</p>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
