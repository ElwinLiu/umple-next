import { cva } from 'class-variance-authority'

export const lineTabClasses = cva(
  'text-xs border-b-2 border-none cursor-pointer transition-colors',
  {
    variants: {
      active: {
        true: 'font-semibold border-b-brand text-brand',
        false: 'font-normal border-b-transparent text-ink-muted hover:text-ink',
      },
    },
  }
)
