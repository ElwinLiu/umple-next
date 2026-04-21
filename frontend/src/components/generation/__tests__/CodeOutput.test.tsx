// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'

vi.mock('@codemirror/lang-java', () => ({
  java: () => 'java-extension',
}))

vi.mock('@codemirror/lang-python', () => ({
  python: () => 'python-extension',
}))

vi.mock('@codemirror/lang-sql', () => ({
  sql: () => 'sql-extension',
}))

import { getLanguageExtension } from '../CodeOutput'

describe('getLanguageExtension', () => {
  it('returns the SQL extension for Sql output', () => {
    expect(getLanguageExtension('Sql')).toBe('sql-extension')
    expect(getLanguageExtension('sql')).toBe('sql-extension')
  })

  it('keeps existing language mappings intact', () => {
    expect(getLanguageExtension('Java')).toBe('java-extension')
    expect(getLanguageExtension('Python')).toBe('python-extension')
  })

  it('falls back to no extension for unsupported languages', () => {
    expect(getLanguageExtension('Alloy')).toBeNull()
  })
})
