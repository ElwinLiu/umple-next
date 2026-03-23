interface MenuItemProps {
  onClick: () => void
  icon: React.ReactNode
  children: React.ReactNode
  variant?: 'destructive'
}

export function MenuItem({ onClick, icon, children, variant }: MenuItemProps) {
  return (
    <button
      onClick={onClick}
      role="menuitem"
      className={`relative flex w-full cursor-default items-center gap-1.5 rounded-sm px-2 py-1 text-xs outline-hidden select-none hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground ${
        variant === 'destructive'
          ? 'text-destructive hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive'
          : ''
      }`}
    >
      <span className={variant === 'destructive' ? '' : 'text-muted-foreground'}>{icon}</span>
      {children}
    </button>
  )
}
