import { useState } from 'react'
import { CheckIcon, ChevronDownIcon, SearchIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command'

export interface ComboboxOption {
  value: string
  label: string
}

interface ComboboxProps {
  options: ComboboxOption[]
  value?: string
  onSelect: (value: string) => void
  placeholder?: string
  searchPlaceholder?: string
  emptyText?: string
  /** Show search input. Defaults to true. */
  searchable?: boolean
  className?: string
}

export function Combobox({
  options,
  value,
  onSelect,
  placeholder = 'Select...',
  searchPlaceholder = 'Search...',
  emptyText = 'No results.',
  searchable = true,
  className,
}: ComboboxProps) {
  const [open, setOpen] = useState(false)

  const selected = options.find((o) => o.value === value)

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          'flex w-full items-center justify-between gap-1 rounded-md border border-surface-2 bg-surface-0 h-8 px-2.5 py-1.5 text-xs text-ink outline-none hover:bg-surface-1 focus:border-brand focus:ring-1 focus:ring-brand transition-colors cursor-pointer',
          !selected && 'text-ink-muted',
          className
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDownIcon className="size-3 shrink-0 text-ink-faint" />
      </PopoverTrigger>

      <PopoverContent
        align="start"
        className="w-[var(--radix-popover-trigger-width)] min-w-[180px] p-0"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        <Command shouldFilter={searchable}>
          {searchable && (
            <CommandInput placeholder={searchPlaceholder} className="h-7 text-xs" />
          )}
          <CommandList className="max-h-[180px]">
            <CommandEmpty className="py-3 text-center text-xs text-ink-faint">
              {emptyText}
            </CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onSelect(option.value)
                    setOpen(false)
                  }}
                  className="gap-1.5 px-2 py-1 text-xs"
                >
                  <CheckIcon className={cn('size-3 shrink-0', option.value === value ? 'opacity-100' : 'opacity-0')} />
                  <span className="truncate">{option.label}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}
