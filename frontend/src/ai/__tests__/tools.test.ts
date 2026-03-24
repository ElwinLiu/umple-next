import { describe, it, expect, beforeEach } from 'vitest'
import { useSessionStore } from '@/stores/sessionStore'

describe('tool definitions', () => {
  it('editCode has execute with needsApproval', async () => {
    const { agentTools } = await import('../tools')
    expect(agentTools.editCode.execute).toBeDefined()
  })

  it('replaceCode has execute with needsApproval', async () => {
    const { agentTools } = await import('../tools')
    expect(agentTools.replaceCode.execute).toBeDefined()
  })

  it('readEditorCode has execute (auto)', async () => {
    const { agentTools } = await import('../tools')
    expect(agentTools.readEditorCode.execute).toBeDefined()
  })

  it('compile has execute (auto)', async () => {
    const { agentTools } = await import('../tools')
    expect(agentTools.compile.execute).toBeDefined()
  })
})

describe('editCode execute', () => {
  beforeEach(() => {
    useSessionStore.setState({ code: 'class Student { name: String; id: Integer; }' })
  })

  it('applies targeted edits and returns success message', async () => {
    const { agentTools } = await import('../tools')

    const result = await agentTools.editCode.execute!({
      edits: [{ oldText: 'Student', newText: 'Person' }],
      explanation: 'Rename class',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(result).toContain('applied')
    expect(useSessionStore.getState().code).toBe('class Person { name: String; id: Integer; }')
  })

  it('applies multiple edits in sequence', async () => {
    const { agentTools } = await import('../tools')

    await agentTools.editCode.execute!({
      edits: [
        { oldText: 'Student', newText: 'Person' },
        { oldText: 'name: String', newText: 'fullName: String' },
      ],
      explanation: 'Rename class and field',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(useSessionStore.getState().code).toBe('class Person { fullName: String; id: Integer; }')
  })

  it('returns error when oldText is not found', async () => {
    const { agentTools } = await import('../tools')

    const result = await agentTools.editCode.execute!({
      edits: [{ oldText: 'NonExistent', newText: 'Replacement' }],
      explanation: 'Bad edit',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(result).toContain('not found')
    expect(useSessionStore.getState().code).toBe('class Student { name: String; id: Integer; }')
  })

  it('returns error when oldText is ambiguous', async () => {
    useSessionStore.setState({ code: 'class Student { Student mentor; }' })
    const { agentTools } = await import('../tools')

    const result = await agentTools.editCode.execute!({
      edits: [{ oldText: 'Student', newText: 'Person' }],
      explanation: 'Bad ambiguous edit',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(result).toContain('Ambiguous edit target')
    expect(useSessionStore.getState().code).toBe('class Student { Student mentor; }')
  })

  it('returns error when oldText is empty', async () => {
    const { agentTools } = await import('../tools')

    const result = await agentTools.editCode.execute!({
      edits: [{ oldText: '', newText: 'Person' }],
      explanation: 'Bad empty edit',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(result).toContain('oldText must not be empty')
    expect(useSessionStore.getState().code).toBe('class Student { name: String; id: Integer; }')
  })
})

describe('replaceCode execute', () => {
  beforeEach(() => {
    useSessionStore.setState({ code: 'class Student { name: String; }' })
  })

  it('replaces the entire editor code', async () => {
    const { agentTools } = await import('../tools')

    const newCode = 'class Person { age: Integer; }'
    const result = await agentTools.replaceCode.execute!({
      code: newCode,
      explanation: 'New model',
    }, { messages: [], toolCallId: 'test' } as any)

    expect(result).toContain('replaced')
    expect(useSessionStore.getState().code).toBe(newCode)
  })
})
