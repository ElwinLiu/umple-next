/** Returns true if the model ID is a temporary (auto-cleanup) model. */
export function isTemporaryModel(id: string | null): boolean {
  return id != null && id.startsWith('tmp')
}
