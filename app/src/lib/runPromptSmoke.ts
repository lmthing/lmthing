import { runPrompt } from 'lmthing'

type RunPromptSmokeResult = {
  ok: boolean
  text?: string
  error?: string
}

export async function runPromptSmoke(): Promise<RunPromptSmokeResult> {
  try {
    const { result } = await runPrompt(
      async (prompt) => {
        void prompt.$`Reply with a short confirmation that the runPrompt call works.`
      },
      {
        model: 'zai:glm-4.5',
        options: {
          maxOutputTokens: 120,
          temperature: 0,
        },
      }
    )

    const text = await result.text
    console.info('[lmthing] runPrompt response:', text)
    return { ok: Boolean(text?.trim()), text }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    }
  }
}
