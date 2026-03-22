import { ToolLoopAgent, stepCountIs } from 'ai'
import type { AiProvider } from '@/stores/aiConfigStore'
import { getModel } from './provider'
import { agentTools } from './tools'

const SYSTEM_PROMPT = `You are an AI assistant for UmpleOnline, a web-based modeling tool for the Umple language.
Umple is a model-oriented programming language that adds UML abstractions (associations, state machines, etc.) directly into code.

You help users write, understand, and debug Umple code. You can:
- Read the current code in the editor
- Make targeted edits to the code (preferred) or replace it entirely
- Compile the code and check for errors

When modifying code:
- Prefer targeted edits (editCode) over full replacement (replaceCode)
- Always explain what you're changing and why
- After making changes, offer to compile to verify correctness

Be concise and direct. Focus on the Umple code.`

export async function createAgent(
  provider: AiProvider,
  model: string,
  apiKey: string,
) {
  const languageModel = await getModel(provider, model, apiKey)
  return new ToolLoopAgent({
    model: languageModel,
    instructions: SYSTEM_PROMPT,
    tools: agentTools,
    stopWhen: stepCountIs(10),
  })
}
