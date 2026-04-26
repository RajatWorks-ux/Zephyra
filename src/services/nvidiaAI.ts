const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1'
const API_KEY = process.env.EXPO_PUBLIC_NVIDIA_API_KEY!
const MODEL = 'mistralai/mistral-small-4-119b-2603'

export interface AIMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

// Stream AI response chunk by chunk
// onChunk is called every time a piece of text arrives
// onComplete is called with the full text when done
export async function streamAIResponse(
  messages: AIMessage[],
  onChunk: (chunk: string) => void,
  onComplete: (fullText: string) => void,
  onError: (error: string) => void,
  temperature: number = 0.10
): Promise<void> {
  try {
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        Accept: 'text/event-stream',
      },
      body: JSON.stringify({
        model: MODEL,
        reasoning_effort: 'high',
        messages,
        max_tokens: 16384,
        temperature,
        top_p: 1.0,
        stream: true,
      }),
    })

    if (!response.ok) {
      const err = await response.text()
      onError(`API error: ${response.status} — ${err}`)
      return
    }

    const reader = response.body?.getReader()
    if (!reader) {
      onError('No response body')
      return
    }

    const decoder = new TextDecoder()
    let fullText = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      const chunk = decoder.decode(value)
      const lines = chunk.split('\n')

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.replace('data: ', '').trim()
        if (data === '[DONE]') continue

        try {
          const parsed = JSON.parse(data)
          const text = parsed.choices?.[0]?.delta?.content || ''
          if (text) {
            fullText += text
            onChunk(text)
          }
        } catch {
          // skip malformed chunks
        }
      }
    }

    onComplete(fullText)
  } catch (error: any) {
    onError(error.message || 'Unknown error')
  }
}

// Non-streaming version for simple calls
export async function getAIResponse(
  messages: AIMessage[],
  temperature: number = 0.10
): Promise<string> {
  const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      reasoning_effort: 'high',
      messages,
      max_tokens: 16384,
      temperature,
      top_p: 1.0,
      stream: false,
    }),
  })

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}