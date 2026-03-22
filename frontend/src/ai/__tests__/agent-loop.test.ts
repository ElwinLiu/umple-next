import { describe, it, expect, beforeAll } from 'vitest'
import { config } from 'dotenv'
import { generateText, tool, stepCountIs } from 'ai'
import { createOpenAI } from '@ai-sdk/openai'
import { z } from 'zod'

config({ path: '.env.test' })

const apiKey = process.env.AI_API_KEY
const modelId = process.env.AI_MODEL
const runLiveAgentTests = process.env.AI_LIVE_TESTS === '1'
const describeLive = runLiveAgentTests ? describe : describe.skip

function getTestModel() {
  if (!apiKey || !modelId) {
    throw new Error('AI_API_KEY and AI_MODEL must be set to run live agent-loop tests')
  }

  return createOpenAI({
    apiKey,
    baseURL: 'https://openrouter.ai/api/v1',
    name: 'openrouter',
  }).chat(modelId)
}

describeLive('agent loop (live)', () => {
  beforeAll(() => {
    if (!apiKey || !modelId) {
      throw new Error('AI_API_KEY and AI_MODEL must be set in .env.test when AI_LIVE_TESTS=1')
    }
  })

  it('can send a simple message and get a text response', async () => {
    const { text } = await generateText({
      model: getTestModel(),
      messages: [{ role: 'user', content: 'Reply with exactly: HELLO' }],
    })

    expect(text.toUpperCase()).toContain('HELLO')
  })

  it('can call an auto-execute tool and continue with the result', async () => {
    const { text, steps } = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'Use the readEditorCode tool to read the code, then tell me the class name.',
        },
      ],
      tools: {
        readEditorCode: tool({
          description: 'Read the current code in the editor',
          inputSchema: z.object({}),
          execute: async () => 'class Student { name: String; id: Integer; }',
        }),
      },
      stopWhen: stepCountIs(5),
    })

    const allToolCalls = steps.flatMap((s) => s.toolCalls)

    console.log('steps:', steps.length)
    console.log('tool calls:', allToolCalls.map((tc) => tc.toolName))
    console.log('finish reasons:', steps.map((s) => s.finishReason))
    console.log('text:', text.slice(0, 300))

    expect(allToolCalls.some((tc) => tc.toolName === 'readEditorCode')).toBe(true)
    expect(steps.length).toBeGreaterThanOrEqual(2)
    expect(text).toMatch(/Student/i)
  })

  it('pauses on a tool without execute (human-in-the-loop)', async () => {
    const { steps } = await generateText({
      model: getTestModel(),
      system: 'You are a code editor assistant. When asked to change code, first read it with readEditorCode, then apply changes with editCode. Always use tools.',
      messages: [
        {
          role: 'user',
          content: 'Rename the class from Student to Person. Read the code first, then edit it.',
        },
      ],
      tools: {
        readEditorCode: tool({
          description: 'Read the current code in the editor',
          inputSchema: z.object({}),
          execute: async () => 'class Student { name: String; id: Integer; }',
        }),
        editCode: tool({
          description: 'Make targeted edits to the code. Each edit replaces oldText with newText.',
          inputSchema: z.object({
            edits: z.array(
              z.object({
                oldText: z.string().describe('Exact text to find'),
                newText: z.string().describe('Replacement text'),
              }),
            ),
            explanation: z.string().describe('What this change does'),
          }),
          // No execute — should pause for human approval
        }),
      },
      stopWhen: stepCountIs(5),
    })

    const allToolCalls = steps.flatMap((s) => s.toolCalls)

    console.log('steps:', steps.length)
    console.log('finish reasons:', steps.map((s) => s.finishReason))
    console.log('tool calls:', JSON.stringify(allToolCalls.map((tc: any) => ({ name: tc.toolName, args: tc.args })), null, 2))

    const editCalls = allToolCalls.filter((tc) => tc.toolName === 'editCode')
    expect(editCalls.length).toBeGreaterThan(0)
    // Tool was called — the loop paused here because editCode has no execute
    // Verify it has the expected structure
    expect(editCalls[0]).toHaveProperty('toolName', 'editCode')
  })

  it('can do a multi-step loop: read → compile', async () => {
    const { text, steps } = await generateText({
      model: getTestModel(),
      messages: [
        {
          role: 'user',
          content: 'First use readEditorCode, then use compile. Report the result.',
        },
      ],
      tools: {
        readEditorCode: tool({
          description: 'Read the current Umple code in the editor',
          inputSchema: z.object({}),
          execute: async () => 'class Student { name: String; id: Integer; }',
        }),
        compile: tool({
          description: 'Compile the current Umple code and return errors if any',
          inputSchema: z.object({}),
          execute: async () => ({ success: true, errors: null }),
        }),
      },
      stopWhen: stepCountIs(5),
    })

    const allToolCalls = steps.flatMap((s) => s.toolCalls)

    console.log('steps:', steps.length)
    console.log('tool calls:', allToolCalls.map((tc) => tc.toolName))
    console.log('finish reasons:', steps.map((s) => s.finishReason))
    console.log('text:', text.slice(0, 300))

    expect(allToolCalls.some((tc) => tc.toolName === 'readEditorCode')).toBe(true)
    expect(allToolCalls.some((tc) => tc.toolName === 'compile')).toBe(true)
    expect(text.toLowerCase()).toMatch(/success|no error|compil|student/i)
  })
})
