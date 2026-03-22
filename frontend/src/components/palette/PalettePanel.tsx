import { useState } from 'react'
import { ExampleBrowser } from './ExampleBrowser'
import { Preferences } from './Preferences'
import { lineTabClasses } from '@/components/ui/line-tab'
import { cn } from '@/lib/utils'

type PaletteTab = 'examples' | 'preferences'

export function PalettePanel() {
  const [activeTab, setActiveTab] = useState<PaletteTab>('examples')

  return (
    <div className="h-full flex flex-col" data-testid="palette-panel">
      <div className="flex bg-surface-1 border-b border-border h-8 items-stretch shrink-0">
        <button
          onClick={() => setActiveTab('examples')}
          className={cn(lineTabClasses({ active: activeTab === 'examples' }), 'flex-1 px-3', activeTab === 'examples' && 'text-ink bg-surface-0')}
        >
          Examples
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={cn(lineTabClasses({ active: activeTab === 'preferences' }), 'flex-1 px-3', activeTab === 'preferences' && 'text-ink bg-surface-0')}
        >
          Preferences
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {activeTab === 'examples' && <ExampleBrowser />}
        {activeTab === 'preferences' && <Preferences />}
      </div>
    </div>
  )
}
