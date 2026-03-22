import { tool } from 'ai'
import { z } from 'zod'
import { useEditorStore } from '@/stores/editorStore'
import { api } from '@/api/client'
import { applyCodeEdits } from './editPreview'

export const agentTools = {
  readEditorCode: tool({
    description: 'Read the current Umple code in the editor',
    inputSchema: z.object({}),
    execute: async () => {
      return useEditorStore.getState().code
    },
  }),

  editCode: tool({
    description:
      'Make targeted edits to the Umple code in the editor. Each edit replaces an exact match of oldText with newText.',
    inputSchema: z.object({
      edits: z.array(
        z.object({
          oldText: z.string().describe('Exact text to find in the current code'),
          newText: z.string().describe('Text to replace it with'),
        }),
      ),
      explanation: z.string().describe('Brief explanation of what this change does'),
    }),
    needsApproval: true,
    execute: async ({ edits, explanation }) => {
      const { code: currentCode } = useEditorStore.getState()
      const { code, errors } = applyCodeEdits(currentCode, edits)

      if (errors.length > 0) {
        return `Edit failed — ${errors.join('; ')}`
      }

      useEditorStore.getState().setCode(code)
      return `Edit applied: ${explanation}`
    },
  }),

  compile: tool({
    description:
      'Compile the current Umple code and return the result including any errors',
    inputSchema: z.object({}),
    execute: async () => {
      const { code, modelId } = useEditorStore.getState()
      const res = await api.compile({ code, modelId: modelId ?? undefined })
      return {
        success: !res.errors,
        errors: res.errors || null,
        modelId: res.modelId,
      }
    },
  }),

  replaceCode: tool({
    description:
      'Replace the entire code in the editor. Use this only when making extensive changes where targeted edits would be impractical.',
    inputSchema: z.object({
      code: z.string().describe('The complete new code'),
      explanation: z.string().describe('Brief explanation of what this change does'),
    }),
    needsApproval: true,
    execute: async ({ code, explanation }) => {
      useEditorStore.getState().setCode(code)
      return `Code replaced: ${explanation}`
    },
  }),
}
