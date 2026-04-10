import { useState, useEffect, useCallback, useMemo } from 'react'
import { useSessionStore } from '../stores/sessionStore'
import { useCollabStore } from '../stores/collabStore'
import { useEphemeralStore } from '../stores/ephemeralStore'
import { collabLoadExample } from './useCollabTabs'
import { api } from '../api/client'
import type { ExampleCategory } from '../api/types'
import { getViewForExampleCategory } from '../constants/diagram'

// Module-level cache so all consumers share one fetch
let cachedCategories: ExampleCategory[] | null = null
let fetchPromise: Promise<ExampleCategory[]> | null = null

export function useExamples() {
  const [allCategories, setAllCategories] = useState<ExampleCategory[]>(cachedCategories ?? [])
  const [loading, setLoading] = useState(cachedCategories === null)
  const localLoadExample = useSessionStore((s) => s.loadExample)
  const isCollaborating = useCollabStore((s) => s.isCollaborating)

  useEffect(() => {
    if (cachedCategories) {
      setAllCategories(cachedCategories)
      setLoading(false)
      return
    }
    if (!fetchPromise) {
      fetchPromise = api.listExamples()
      fetchPromise
        .then((cats) => { cachedCategories = cats })
        .catch(() => { fetchPromise = null })
    }
    fetchPromise
      .then((cats) => {
        setAllCategories(cats)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  const categories = useMemo(
    () => allCategories.filter((cat) => cat.examples.length > 0),
    [allCategories],
  )

  const loadExample = useCallback(async (name: string, categoryName?: string) => {
    if (categoryName) {
      const targetView = getViewForExampleCategory(categoryName)
      if (targetView) useSessionStore.getState().setViewMode(targetView)
    }
    try {
      const res = await api.getExample(name)
      if (isCollaborating) {
        collabLoadExample(res.name, res.code, res.modelId)
      } else {
        localLoadExample(res.name, res.code, res.modelId)
      }
      useEphemeralStore.getState().setRightPanelView('diagram')
    } catch { /* ignore */ }
  }, [localLoadExample, isCollaborating])

  return { categories, loadExample, loading }
}
