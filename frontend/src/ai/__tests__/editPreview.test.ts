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

  it('matches LF oldText against CRLF source code', () => {
    const crlfCode = 'class Role {\r\n  code;\r\n  key {code}\r\n}'

    const result = applyCodeEdits(crlfCode, [
      {
        oldText: 'class Role {\n  code;\n  key {code}\n}',
        newText: 'class Role {\n  code;\n  key {code}\n}\n\nclass Anyone {\n  id;\n}',
      },
    ])

    expect(result.errors).toEqual([])
    expect(result.code).toContain('class Anyone')
  })

  it('matches CRLF oldText against CRLF source code', () => {
    const crlfCode = 'class Foo {\r\n  bar;\r\n}'

    const result = applyCodeEdits(crlfCode, [
      { oldText: 'class Foo {\r\n  bar;\r\n}', newText: 'class Foo {\n  baz;\n}' },
    ])

    expect(result.errors).toEqual([])
    expect(result.code).toContain('baz')
  })

  it('returns not-found when text genuinely does not exist', () => {
    const code = 'class Foo {\n  bar;\n}'

    const result = applyCodeEdits(code, [
      { oldText: 'class Baz { totally; wrong; }', newText: 'nope' },
    ])

    expect(result.errors).toHaveLength(1)
    expect(result.errors[0]).toContain('Text not found')
  })

  it('output is always LF-normalized', () => {
    const crlfCode = 'class A {\r\n  x;\r\n}'

    const result = applyCodeEdits(crlfCode, [
      { oldText: 'class A {\n  x;\n}', newText: 'class A {\n  y;\n}' },
    ])

    expect(result.errors).toEqual([])
    expect(result.code).not.toContain('\r')
    expect(result.code).toBe('class A {\n  y;\n}')
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
