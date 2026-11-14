import { cn } from '@/lib/utils'

/** Flat wordmark: a "P" mark in ink with one lamp dot, then the name in the interface family. */
export function Logo({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
        <rect width="32" height="32" rx="8" className="fill-foreground" />
        <path
          d="M9 22V10h9.5a3 3 0 0 1 0 6H9"
          fill="none"
          className="stroke-background"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="23" cy="22" r="2.4" fill="var(--lamp)" />
      </svg>
      <span className="text-[17px] font-medium tracking-[-0.01em]">FinPilot</span>
    </span>
  )
}
