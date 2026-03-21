import { useEffect } from 'react'
import { AppShell } from './components/layout/AppShell'
import { useUiStore } from './stores/uiStore'
import { TooltipProvider } from '@/components/ui/tooltip'

function useThemeEffect() {
  const theme = useUiStore((s) => s.theme)

  useEffect(() => {
    const apply = (resolved: 'light' | 'dark') => {
      document.documentElement.classList.toggle('dark', resolved === 'dark')
    }

    if (theme === 'system') {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      apply(mq.matches ? 'dark' : 'light')
      const handler = (e: MediaQueryListEvent) => apply(e.matches ? 'dark' : 'light')
      mq.addEventListener('change', handler)
      return () => mq.removeEventListener('change', handler)
    }

    apply(theme)
  }, [theme])
}

export default function App() {
  useThemeEffect()
  return (
    <TooltipProvider>
      <AppShell />
    </TooltipProvider>
  )
}
