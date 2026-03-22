import { describe, expect, it } from 'vitest'
import { applyCodeEdits, buildToolCallDiffPreview } from '../editPreview'

describe('applyCodeEdits', () => {
  it('applies unique edits in sequence', () => {
    const result = applyCodeEdits('class Student { name: String; }', [
      { oldText: 'Student', newText: 'Person' },
      { oldText: 'name: String', newText: 'fullName: String' },
    ])

    expect(result.errors).toEqual([])
    expect(result.code).toBe('class Person { fullName: String; }')
  })

  it('reports ambiguous edit targets', () => {
    const result = applyCodeEdits('class Student { Student mentor; }', [
      { oldText: 'Student', newText: 'Person' },
    ])

    expect(result.errors[0]).toContain('Ambiguous edit target')
  })
})

describe('buildToolCallDiffPreview', () => {
  it('builds an edit preview from the current code', () => {
    const result = buildToolCallDiffPreview(
      'call-1',
      'editCode',
      {
        explanation: 'Rename Student to Person',
        edits: [{ oldText: 'Student', newText: 'Person' }],
      },
      'class Student {}',
    )

    expect(result.error).toBeNull()
    expect(result.preview).toMatchObject({
      toolCallId: 'call-1',
      toolName: 'editCode',
      proposedCode: 'class Person {}',
    })
  })

  it('builds a replace preview', () => {
    const result = buildToolCallDiffPreview(
      'call-2',
      'replaceCode',
      {
        explanation: 'Replace the model',
        code: 'class Person {}',
      },
      'class Student {}',
    )

    expect(result.error).toBeNull()
    expect(result.preview).toMatchObject({
      toolCallId: 'call-2',
      toolName: 'replaceCode',
      proposedCode: 'class Person {}',
      originalCode: 'class Student {}',
    })
  })
})
