import { type NextRequest, NextResponse } from "next/server"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { generateText } from "ai"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get("audio") as File
    const provider = formData.get("provider") as string
    const model = formData.get("model") as string
    const apiKey = formData.get("apiKey") as string
    const systemPrompt = formData.get("systemPrompt") as string

    if (!audioFile || !provider || !model || !apiKey) {
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
      case "anthropic":
        modelInstance = anthropic(model, { apiKey })
        break
      case "google":
        modelInstance = google(model, { apiKey })
        break
      default:
        return NextResponse.json({ error: "Unsupported provider" }, { status: 400 })
    }

    // For OpenAI, we can use their audio transcription API
    if (provider === "openai") {
      const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
        body: (() => {
          const formData = new FormData()
          formData.append("file", audioFile)
          formData.append("model", "whisper-1")
          formData.append("prompt", systemPrompt || "Transcribe this audio accurately.")
          return formData
        })(),
      })

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.statusText}`)
      }

      const result = await response.json()
      return NextResponse.json({ transcription: result.text })
    }

    // For other providers, use multimodal capabilities
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
            {
              type: "file",
              data: base64Audio,
              mimeType: audioFile.type,
            },
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
