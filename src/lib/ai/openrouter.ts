import { sanitizeForPrompt } from "@/lib/utils";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-4o-mini";
const TIMEOUT_MS = 60000;
const MAX_RETRIES = 2;

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface OpenRouterOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  jsonMode?: boolean;
}

export async function callOpenRouter(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not configured");
  }

  const model = options.model || process.env.OPENROUTER_MODEL || DEFAULT_MODEL;

  const sanitizedMessages = messages.map((m) => ({
    ...m,
    content: sanitizeForPrompt(m.content),
  }));

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

      const response = await fetch(OPENROUTER_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
          "X-Title": "HireWise AI",
        },
        body: JSON.stringify({
          model,
          messages: sanitizedMessages,
          temperature: options.temperature ?? 0.3,
          max_tokens: options.maxTokens ?? 4096,
          ...(options.jsonMode && { response_format: { type: "json_object" } }),
        }),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (response.status === 429) {
        const retryAfter = parseInt(response.headers.get("retry-after") || "5", 10);
        await new Promise((r) => setTimeout(r, retryAfter * 1000));
        continue;
      }

      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`OpenRouter API error (${response.status}): ${errorBody}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;

      if (!content) {
        throw new Error("Empty response from OpenRouter");
      }

      return content;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      if (attempt < MAX_RETRIES) {
        await new Promise((r) => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }

  throw lastError || new Error("OpenRouter request failed");
}

export async function callOpenRouterJSON<T>(
  messages: ChatMessage[],
  options: OpenRouterOptions = {}
): Promise<T> {
  const content = await callOpenRouter(messages, { ...options, jsonMode: true });

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON found in response");
    return JSON.parse(jsonMatch[0]) as T;
  } catch {
    throw new Error(`Failed to parse AI JSON response: ${content.slice(0, 200)}`);
  }
}
