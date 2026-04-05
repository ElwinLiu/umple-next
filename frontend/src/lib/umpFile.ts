/** Ensure a tab name has the `.ump` extension. */
export function ensureUmpExt(name: string): string {
  return name.endsWith('.ump') ? name : name + '.ump'
}

/** Strip the `.ump` extension for display purposes. */
export function stripUmpExt(name: string): string {
  return name.endsWith('.ump') ? name.slice(0, -4) : name
}
