import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { mistral } from "@ai-sdk/mistral"
import { azure, createAzure } from "@ai-sdk/azure"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
import { generateText } from "ai"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const provider = formData.get("provider") as string
    const model = formData.get("model") as string
    const apiKey = formData.get("apiKey") as string
    const systemPrompt = formData.get("systemPrompt") as string
    const baseURL = (formData.get("baseURL") as string) || undefined
    const apiVersion = (formData.get("apiVersion") as string) || undefined

    if (!audioFile || !provider || !model) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 })
    }

    // Convert audio file to base64
    const arrayBuffer = await audioFile.arrayBuffer()
    const base64Audio = Buffer.from(arrayBuffer).toString("base64")

    // Get the appropriate model instance
    let modelInstance
    switch (provider) {
      case "openai":
        modelInstance = openai(model, { apiKey })
        break
      case "azure-openai": {
        if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 })
        const az = createAzure({ apiKey, ...(baseURL ? { baseURL } : {}), ...(apiVersion ? { apiVersion } : {}) })
        modelInstance = az(model) // deployment name
        break
      }
      case "anthropic":
        modelInstance = anthropic(model, { apiKey })
        break
      case "google":
        modelInstance = google(model, { apiKey })
        break
      case "mistral":
        modelInstance = mistral(model, { apiKey })
        break
      case "openai-compatible": {
        if (!baseURL) return NextResponse.json({ error: "Base URL required" }, { status: 400 })
        const compat = createOpenAICompatible({ baseURL, apiKey, name: "custom" })
        modelInstance = compat.chatModel(model)
        break
      }
      default:
        return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
    }

    // Fast-path: OpenAI Whisper for best ASR if available
    if (provider === "openai") {
      if (!apiKey) return NextResponse.json({ error: "API key required" }, { status: 400 })
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: (() => {
          const fd = new FormData()
          fd.append("file", audioFile)
          fd.append("model", "whisper-1")
          fd.append("prompt", systemPrompt || "Transcribe this audio accurately.")
          return fd
        })(),
      })
      if (!response.ok) throw new Error(`OpenAI API error: ${response.statusText}`)
      const result = await response.json()
      return NextResponse.json({ transcription: result.text })
    }

    // Generic multimodal transcription for other providers
    const prompt =
      systemPrompt ||
      "Transcribe this audio recording accurately. Provide only the transcription without any additional commentary."

    const { text } = await generateText({
      model: modelInstance,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "file", data: base64Audio, mimeType: audioFile.type },
          ],
        },
      ],
    })

    return NextResponse.json({ transcription: text })
  } catch (error) {
    console.error("Transcription error:", error)
    return NextResponse.json({ error: "Failed to transcribe audio" }, { status: 500 })
  }
}
