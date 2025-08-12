import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"
import { google } from "@ai-sdk/google"
import { mistral } from "@ai-sdk/mistral"
import { azure, createAzure } from "@ai-sdk/azure"
import { createOpenAICompatible } from "@ai-sdk/openai-compatible"
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
      baseURL,
      apiVersion,
    } = await request.json()

    if (!transcript || !systemPrompt) {
      return NextResponse.json(
        { error: "Missing required fields: transcript and systemPrompt" },
        { status: 400 }
      )
    }

    const polishedText = await polishTextWithAI(
      transcript,
      systemPrompt,
      examples,
      provider,
      model,
      apiKey,
      baseURL,
      apiVersion,
    )

    return NextResponse.json({ polishedText })
  } catch (error) {
    console.error("Error polishing transcript:", error)
    return NextResponse.json(
      { error: "Failed to polish transcript" },
      { status: 500 }
    )
  }
}

async function polishTextWithAI(
  transcript: string,
  systemPrompt: string,
  examples: Example[],
  provider: string,
  model: string,
  apiKey?: string,
  baseURL?: string,
  apiVersion?: string,
): Promise<string> {
  try {
    // Build the prompt with few-shot examples
    let prompt = systemPrompt + "\n\n"
    
    if (examples.length > 0) {
      prompt += "Here are some examples of the desired output format:\n\n"
      examples.forEach((example, index) => {
        prompt += `Example ${index + 1}:\nInput: ${example.input}\nOutput: ${example.output}\n\n`
      })
      prompt += "Now please process the following transcript:\n\n"
    }
    
    prompt += transcript

    let modelInstance
    switch (provider) {
      case "openai":
        modelInstance = apiKey ? openai(model, { apiKey }) : openai(model)
        break
      case "azure-openai": {
        // Azure: pass baseURL (recommended) or rely on env resource name
        const az = createAzure({
          apiKey: apiKey!,
          ...(baseURL ? { baseURL } : {}),
          ...(apiVersion ? { apiVersion } : {}),
        })
        modelInstance = az(model) // 'model' is the deployment name
        break
      }
      case "anthropic":
        if (!apiKey) throw new Error("API key required for Anthropic")
        modelInstance = anthropic(model, { apiKey })
        break
      case "google":
        if (!apiKey) throw new Error("API key required for Google")
        modelInstance = google(model, { apiKey })
        break
      case "mistral":
        if (!apiKey) throw new Error("API key required for Mistral")
        modelInstance = mistral(model, { apiKey })
        break
      case "openai-compatible": {
        if (!baseURL) throw new Error("Base URL required for OpenAI-compatible provider")
        const compat = createOpenAICompatible({ baseURL, apiKey, name: "custom" })
        modelInstance = compat.chatModel(model)
        break
      }
      default:
        // Fallback to OpenAI if provider is not recognized
        modelInstance = openai("gpt-4o-mini")
    }

    const { text } = await generateText({
      model: modelInstance,
      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],
    })

    return text
  } catch (error) {
    console.error("Error in polishTextWithAI:", error)
    throw error
  }
}
