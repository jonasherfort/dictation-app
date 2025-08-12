"use client"

import { useMemo, useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Eye, EyeOff, Save } from "lucide-react"
import { useToast } from "@/hooks/use-toast"

export interface LLMConfig {
  provider: string
  model: string
  apiKey?: string
  // Optional per-provider fields:
  baseURL?: string        // Azure/OpenAI-compatible
  apiVersion?: string     // Azure
  // (Keep interface open for future fields)
}

interface LLMConfigProps {
  transcriptionConfig: LLMConfig
  polishingConfig: LLMConfig
  onTranscriptionConfigChange: (config: LLMConfig) => void
  onPolishingConfigChange: (config: LLMConfig) => void
  onClose: () => void
}

type ProviderKey =
  | "openai"
  | "azure-openai"
  | "google"
  | "anthropic"
  | "mistral"
  | "openai-compatible"

const PROVIDERS: {
  value: ProviderKey
  label: string
  // static model lists; users can still paste any string
  models?: string[]
  // which extra fields to render
  extra?: Array<"baseURL" | "deploymentNote" | "apiVersion">
}[] = [
  { value: "openai", label: "OpenAI", models: ["gpt-4o", "gpt-4o-mini", "gpt-4-turbo"] },
  { value: "azure-openai", label: "Azure OpenAI", models: [], extra: ["baseURL", "deploymentNote", "apiVersion"] },
  { value: "google", label: "Google (Gemini)", models: ["gemini-2.0-flash-exp", "gemini-1.5-pro", "gemini-1.5-flash"] },
  { value: "anthropic", label: "Anthropic", models: ["claude-3-5-sonnet-20241022", "claude-3-haiku-20240307"] },
  { value: "mistral", label: "Mistral", models: ["mistral-large-latest", "mistral-small-latest", "ministral-8b-latest"] },
  { value: "openai-compatible", label: "OpenAI-Compatible (Local/Custom)", models: [], extra: ["baseURL"] },
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

  const getModelsForProvider = (provider: string) =>
    PROVIDERS.find((p) => p.value === provider)?.models ?? []

  const getExtraForProvider = (provider: string) =>
    PROVIDERS.find((p) => p.value === provider)?.extra ?? []

  const validateConfig = (cfg: LLMConfig, kind: "Transcription" | "Polishing"): string | null => {
    if (!cfg.provider) return `${kind}: Select a provider`
    // Common requirements
    if (!cfg.model) {
      // For Azure, "model" is the deployment name
      return `${kind}: Select or enter a model${cfg.provider === "azure-openai" ? " (deployment name)" : ""}`
    }
    if (cfg.provider !== "openai-compatible" && !cfg.apiKey) {
      // openai-compatible (local) may not need a key
      return `${kind}: API key is required`
    }
    // Provider specifics
    if (cfg.provider === "azure-openai") {
      if (!cfg.baseURL) return `${kind}: Azure base URL is required (e.g. https://<resource>.openai.azure.com)`
      // apiVersion optional; default applied in API
    }
    if (cfg.provider === "openai-compatible") {
      if (!cfg.baseURL) return `${kind}: Base URL is required for OpenAI-compatible providers`
    }
    return null
  }

  const handleSave = () => {
    const tErr = validateConfig(transcriptionConfig, "Transcription")
    if (tErr) {
      toast({ title: "Invalid Configuration", description: tErr, variant: "destructive" })
      return
    }
    const pErr = validateConfig(polishingConfig, "Polishing")
    if (pErr) {
      toast({ title: "Invalid Configuration", description: pErr, variant: "destructive" })
      return
    }

    localStorage.setItem("dictation-transcription-config", JSON.stringify(transcriptionConfig))
    localStorage.setItem("dictation-polishing-config", JSON.stringify(polishingConfig))

    toast({ title: "Configuration Saved", description: "LLM settings have been saved successfully" })
    onClose()
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
  }) => {
    const extra = useMemo(() => getExtraForProvider(config.provider), [config.provider])

    return (
      <Card className="border-slate-600 bg-slate-800/30">
        <CardHeader>
          <CardTitle className="text-white text-lg">{title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label className="text-slate-300">Provider</Label>
            <Select
              value={config.provider}
              onValueChange={(value) => onChange({ ...config, provider: value, model: "", baseURL: "", apiVersion: undefined })}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder="Select provider" />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value} className="text-white">
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Base URL (Azure + OpenAI-compatible) */}
          {extra.includes("baseURL") && (
            <div className="space-y-2">
              <Label className="text-slate-300">
                {config.provider === "azure-openai" ? "Azure Base URL" : "Base URL"}
              </Label>
              <Input
                value={config.baseURL ?? ""}
                onChange={(e) => onChange({ ...config, baseURL: e.target.value })}
                placeholder={
                  config.provider === "azure-openai"
                    ? "https://<resource>.openai.azure.com"
                    : "http://localhost:11434/v1  (or your proxy URL)"
                }
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Azure API version */}
          {extra.includes("apiVersion") && (
            <div className="space-y-2">
              <Label className="text-slate-300">Azure API Version (optional)</Label>
              <Input
                value={config.apiVersion ?? ""}
                onChange={(e) => onChange({ ...config, apiVersion: e.target.value })}
                placeholder="preview"
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
              />
            </div>
          )}

          {/* Azure note */}
          {extra.includes("deploymentNote") && (
            <p className="text-xs text-slate-400">
              For Azure, enter your <span className="text-slate-300">deployment name</span> into the Model field below.
            </p>
          )}

          <div className="space-y-2">
            <Label className="text-slate-300">Model</Label>
            <Select
              value={config.model}
              onValueChange={(value) => onChange({ ...config, model: value })}
              disabled={!config.provider}
            >
              <SelectTrigger className="bg-slate-900/50 border-slate-600 text-white">
                <SelectValue placeholder={config.provider === "azure-openai" ? "Deployment name (or type custom)" : "Select model"} />
              </SelectTrigger>
              <SelectContent className="bg-slate-800 border-slate-600">
                {(getModelsForProvider(config.provider) as string[]).map((m) => (
                  <SelectItem key={m} value={m} className="text-white">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Free-form input in case it's not in the list */}
            <Input
              value={config.model}
              onChange={(e) => onChange({ ...config, model: e.target.value })}
              placeholder={config.provider === "azure-openai" ? "Or type deployment name..." : "Or type model id..."}
              className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400"
            />
          </div>

          {/* API key (optional for openai-compatible) */}
          <div className="space-y-2">
            <Label className="text-slate-300">
              API Key{config.provider === "openai-compatible" ? " (optional)" : ""}
            </Label>
            <div className="relative">
              <Input
                type={showKey ? "text" : "password"}
                value={config.apiKey ?? ""}
                onChange={(e) => onChange({ ...config, apiKey: e.target.value })}
                placeholder={
                  config.provider === "openai-compatible"
                    ? "If your local/custom server requires it"
                    : "Enter your API key"
                }
                className="bg-slate-900/50 border-slate-600 text-white placeholder:text-slate-400 pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3 text-slate-400 hover:text-white"
                onClick={() => setShowKey(!showKey)}
                aria-label="Toggle API key visibility"
              >
                {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

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
          <h4 className="text-sm font-medium text-white mb-2">Notes</h4>
          <ul className="text-xs text-slate-300 space-y-1">
            <li>• Azure OpenAI: set <b>Base URL</b> (e.g. https://&lt;resource&gt;.openai.azure.com) and use your deployment name in the Model field.</li>
            <li>• OpenAI-compatible (Local/Custom): set <b>Base URL</b> (e.g. http://localhost:11434/v1) and a model name your server exposes.</li>
            <li>• API keys are stored locally in your browser.</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  )
}
