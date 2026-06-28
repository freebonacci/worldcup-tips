import { teamFlag } from '../lib/bracket.js'
import { Loader2 } from 'lucide-react'

// A team name with its flag (best-effort). `placeholder` shows when unknown.
export function Team({ name, label, className = '', muted = false }) {
  const flag = teamFlag(name)
  const text = name || label || 'TBD'
  return (
    <span
      className={`inline-flex items-center gap-1.5 ${
        muted ? 'text-night-300 italic' : ''
      } ${className}`}
    >
      {flag && <span className="text-base leading-none">{flag}</span>}
      <span className="truncate">{text}</span>
    </span>
  )
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  className = '',
  disabled = false,
  type = 'button',
}) {
  const base =
    'inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition active:scale-[0.97] disabled:opacity-40 disabled:active:scale-100 disabled:cursor-not-allowed select-none'
  const variants = {
    primary:
      'bg-pitch-500 hover:bg-pitch-400 text-night-950 shadow-lg shadow-pitch-900/40',
    flame:
      'bg-flame-500 hover:bg-flame-400 text-night-950 shadow-lg shadow-flame-600/30',
    ghost:
      'bg-white/5 hover:bg-white/10 text-night-100 border border-white/10',
    subtle: 'bg-night-800/60 hover:bg-night-700 text-night-100',
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} px-5 py-3 text-base ${className}`}
    >
      {children}
    </button>
  )
}

export function Spinner({ label = 'Loading…' }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-night-300">
      <Loader2 className="h-7 w-7 animate-spin text-pitch-400" />
      <span className="text-sm">{label}</span>
    </div>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div
      className={`rounded-2xl border border-white/10 bg-white/[0.04] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  )
}

export function RoundBadge({ children, className = '' }) {
  return (
    <span
      className={`inline-block rounded-full bg-night-700/70 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-night-100 ${className}`}
    >
      {children}
    </span>
  )
}
