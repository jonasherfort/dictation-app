import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { type NextRequest, NextResponse } from "next/server"

interface Example {
  input: string
  output: string
}

export async function POST(request: NextRequest) {
  try {
    const {
      transcript,
      systemPrompt,
      examples = [],
      provider = "openai",
      model = "gpt-4o-mini",
      apiKey,
    } = await request.json()

    if (!transcript || !transcript.trim()) {
      return NextResponse.json({ error: "Transcript is required" }, { status: 400 })
    }

    const polishedText = await polishTextWithAI(transcript, systemPrompt, examples, provider, model, apiKey)

    return NextResponse.json({ polishedText })
  } catch (error) {
    console.error("Error in polish API:", error)
    return NextResponse.json({ error: "Failed to polish transcript" }, { status: 500 })
  }
}

async function polishTextWithAI(
  transcript: string,
  systemPrompt: string,
  examples: Example[],
  provider: string,
  model: string,
  apiKey?: string,
): Promise<string> {
  try {
    // Build the prompt with few-shot examples
    let prompt = systemPrompt + "\n\n"

    // Add examples if provided (following the pattern from the Python file)
    if (examples.length > 0) {
      prompt += "Here are some examples of how to polish transcriptions:\n\n"

      examples.forEach((example, index) => {
        if (example.input.trim() && example.output.trim()) {
          prompt += `Example ${index + 1}:\n`
          prompt += `Input: ${example.input.trim()}\n`
          prompt += `Output: ${example.output.trim()}\n\n`
        }
      })
    }

    prompt += `Now polish this transcription:\n${transcript}`

    let modelInstance
    switch (provider) {
      case "openai":
        modelInstance = apiKey ? openai(model, { apiKey }) : openai(model)
        break
      case "anthropic":
        if (!apiKey) {
          throw new Error("API key required for Anthropic")
        }
        modelInstance = anthropic(model, { apiKey })
        break
      case "google":
        if (!apiKey) {
          throw new Error("API key required for Google")
        }
        modelInstance = google(model, { apiKey })
        break
      default:
        // Fallback to OpenAI if provider is not recognized
        modelInstance = openai("gpt-4o-mini")
    }

    const { text } = await generateText({
      model: modelInstance,
      prompt: prompt,
      maxTokens: 1000,
      temperature: 0.3,
    })

    return text
  } catch (error) {
    console.error("AI polishing failed:", error)

    // Fallback to basic text cleanup if AI fails
    let polished = transcript
      .replace(/\buh\b/gi, "")
      .replace(/\bum\b/gi, "")
      .replace(/\ber\b/gi, "")
      .replace(/\s+/g, " ")
      .trim()

    polished = polished.replace(/(^|[.!?]\s+)([a-z])/g, (match, p1, p2) => p1 + p2.toUpperCase())

    if (polished && !polished.match(/[.!?]$/)) {
      polished += "."
    }

    return polished + "\n\n[Note: AI polishing unavailable, basic cleanup applied]"
  }
}
