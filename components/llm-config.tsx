"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

interface LLMConfig {
  provider: string
  model: string
  apiKey: string
}

interface LLMConfigProps {
  transcriptionConfig: LLMConfig
  polishingConfig: LLMConfig
  onTranscriptionConfigChange: (config: LLMConfig) => void
  onPolishingConfigChange: (config: LLMConfig) => void
  onClose: () => void
}

const PROVIDERS = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"] },
  { value: "google", label: "Google", models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"] },
]

export function LLMConfig({
  transcriptionConfig,
  polishingConfig,
  onTranscriptionConfigChange,
  onPolishingConfigChange,
  onClose,
}: LLMConfigProps) {
  const [showTranscriptionKey, setShowTranscriptionKey] = useState(false)
  const [showPolishingKey, setShowPolishingKey] = useState(false)
  const { toast } = useToast()

  const handleSave = () => {
    // Validate configurations
    if (!transcriptionConfig.provider || !transcriptionConfig.model || !transcriptionConfig.apiKey) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in all transcription settings",
        variant: "destructive",
      })
      return
    }

    if (!polishingConfig.provider || !polishingConfig.model || !polishingConfig.apiKey) {
      toast({
        title: "Invalid Configuration",
        description: "Please fill in all polishing settings",
        variant: "destructive",
      })
      return
    }

    // Save to localStorage
    localStorage.setItem("dictation-transcription-config", JSON.stringify(transcriptionConfig))
    localStorage.setItem("dictation-polishing-config", JSON.stringify(polishingConfig))

    toast({
      title: "Configuration Saved",
      description: "LLM settings have been saved successfully",
    })
    onClose()
  }

  const getModelsForProvider = (provider: string) => {
    return PROVIDERS.find((p) => p.value === provider)?.models || []
  }

  const ConfigSection = ({
    title,
    config,
    onChange,
    showKey,
    setShowKey,
  }: {
    title: string
    config: LLMConfig
    onChange: (config: LLMConfig) => void
    showKey: boolean
    setShowKey: (show: boolean) => void
  }) => (
    <Card className="border-slate-600 bg-slate-800/30">
      <CardHeader>
        <CardTitle className="text-white text-lg">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor={`${title.toLowerCase()}-provider`} className="text-slate-300">
            Provider
          </Label>
          <Select
            value={config.provider}
            onValueChange={(value) => onChange({ ...config, provider: value, model: "" })}
          >
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="Select provider" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {PROVIDERS.map((provider) => (
                <SelectItem key={provider.value} value={provider.value} className="text-white">
                  {provider.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${title.toLowerCase()}-model`} className="text-slate-300">
            Model
          </Label>
          <Select
            value={config.model}
            onValueChange={(value) => onChange({ ...config, model: value })}
            disabled={!config.provider}
          >
            <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
              <SelectValue placeholder="Select model" />
            </SelectTrigger>
            <SelectContent className="bg-slate-800 border-slate-600">
              {getModelsForProvider(config.provider).map((model) => (
                <SelectItem key={model} value={model} className="text-white">
                  {model}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor={`${title.toLowerCase()}-key`} className="text-slate-300">
            API Key
          </Label>
          <div className="relative">
            <Input
              id={`${title.toLowerCase()}-key`}
              type={showKey ? "text" : "password"}
              value={config.apiKey}
              onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
              placeholder="Enter your API key"
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400 pr-10"
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
              onClick={() => setShowKey(!showKey)}
            >
              {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )

  return (
    <Card className="border-slate-700 bg-slate-800/50 backdrop-blur">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl text-white">LLM Configuration</CardTitle>
        <div className="flex gap-2">
          <Button onClick={handleSave} variant="outline" size="sm">
            <Save className="w-4 h-4 mr-2" />
            Save
          </Button>
          <Button onClick={onClose} variant="outline" size="sm">
            Close
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="transcription" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-700/50">
            <TabsTrigger value="transcription">Transcription</TabsTrigger>
            <TabsTrigger value="polishing">Polishing</TabsTrigger>
          </TabsList>

          <TabsContent value="transcription" className="space-y-4">
            <ConfigSection
              title="Transcription"
              config={transcriptionConfig}
              onChange={onTranscriptionConfigChange}
              showKey={showTranscriptionKey}
              setShowKey={setShowTranscriptionKey}
            />
          </TabsContent>

          <TabsContent value="polishing" className="space-y-4">
            <ConfigSection
              title="Polishing"
              config={polishingConfig}
              onChange={onPolishingConfigChange}
              showKey={showPolishingKey}
              setShowKey={setShowPolishingKey}
            />
          </TabsContent>
        </Tabs>

        <div className="mt-6 p-4 bg-slate-900/30 rounded-lg border border-slate-600">
          <h4 className="text-sm font-medium text-white mb-2">Configuration Notes:</h4>
          <ul className="text-xs text-slate-300 space-y-1">
            <li>• Transcription: Converts audio recordings directly to text using LLM</li>
            <li>• Polishing: Improves and formats the transcribed text</li>
            <li>• API keys are stored locally in your browser</li>
            <li>• Different providers can be used for each function</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
