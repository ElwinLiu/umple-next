import { useState } from 'react'
import { ExampleBrowser } from './ExampleBrowser'
import { Preferences } from './Preferences'

type PaletteTab = 'examples' | 'preferences'

export function PalettePanel() {
  const [activeTab, setActiveTab] = useState<PaletteTab>('examples')

  return (
    <div className="h-full flex flex-col" data-testid="palette-panel">
      <div className="flex bg-surface-1 border-b border-border h-8 items-stretch shrink-0">
        <button
          onClick={() => setActiveTab('examples')}
          className={`flex-1 px-3 text-xs border-none cursor-pointer transition-colors ${
            activeTab === 'examples'
              ? 'font-semibold border-b-2 border-b-brand bg-surface-0 text-ink'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-ink-muted hover:text-ink hover:bg-surface-1'
          }`}
        >
          Examples
        </button>
        <button
          onClick={() => setActiveTab('preferences')}
          className={`flex-1 px-3 text-xs border-none cursor-pointer transition-colors ${
            activeTab === 'preferences'
              ? 'font-semibold border-b-2 border-b-brand bg-surface-0 text-ink'
              : 'font-normal border-b-2 border-b-transparent bg-transparent text-ink-muted hover:text-ink hover:bg-surface-1'
          }`}
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
