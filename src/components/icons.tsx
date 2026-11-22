import {
  BookOpen,
  Car,
  HeartPulse,
  Plane,
  ReceiptText,
  Shield,
  Tag,
  Target,
  Ticket,
  type LucideIcon,
} from 'lucide-react'
import type { CategoryId, Goal } from '../types'

export const asset = (name: string) => `/assets/${name}`

/** Design SVG at its intrinsic size, centered inside a box. */
export function Asset({ name, size, className = '' }: { name: string; size: number; className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center ${className}`} style={{ width: size, height: size }}>
      <img alt="" src={asset(name)} className="block max-w-none" />
    </span>
  )
}

/**
 * Design SVG painted with the current text color (CSS mask), so the icon can
 * change color by state — used by the bottom tab bar.
 */
export function TintIcon({ name, size, className = '' }: { name: string; size: number; className?: string }) {
  const mask = `url(${asset(name)}) center / contain no-repeat`
  return (
    <span
      aria-hidden
      className={`inline-block shrink-0 bg-current ${className}`}
      style={{ width: size, height: size, mask, WebkitMask: mask }}
    />
  )
}

/* Row icons (light, inside #242428 circles) */
const ROW_ASSETS: Partial<Record<CategoryId, string>> = {
  alimentacao: 'c04b1.svg',
  transporte: '130e8.svg',
  moradia: '4de83.svg',
  assinaturas: '7f1c0.svg',
}
const ROW_LUCIDE: Partial<Record<CategoryId, LucideIcon>> = {
  lazer: Ticket,
  saude: HeartPulse,
  outros: ReceiptText,
}

/* Tile icons (dark, on top of colored category tiles) */
const TILE_ASSETS: Partial<Record<CategoryId, string>> = {
  moradia: 'cd608.svg',
  alimentacao: '92455.svg',
  transporte: '6dd0e.svg',
}
const TILE_LUCIDE: Partial<Record<CategoryId, LucideIcon>> = {
  lazer: Ticket,
  assinaturas: ReceiptText,
  saude: HeartPulse,
  outros: ReceiptText,
}

const isRestaurant = (name?: string) => !!name && /restaurante|delivery|ifood|lanche|pizza|burger/i.test(name)

export function CategoryRowIcon({ category, name, size = 21 }: { category: CategoryId; name?: string; size?: number }) {
  if (category === 'alimentacao' && isRestaurant(name)) return <Asset name="07e92.svg" size={size} />
  const a = ROW_ASSETS[category]
  if (a) return <Asset name={a} size={size} />
  // Categories the person created get a tag icon
  const Icon = ROW_LUCIDE[category] ?? Tag
  return <Icon size={Math.round(size * 0.9)} strokeWidth={1.6} className="text-esk-text-2" aria-hidden />
}

export function CategoryTileIcon({ category }: { category: CategoryId }) {
  const a = TILE_ASSETS[category]
  if (a) return <Asset name={a} size={24} />
  const Icon = TILE_LUCIDE[category] ?? Tag
  return <Icon size={22} strokeWidth={1.6} className="text-esk-ink" aria-hidden />
}

export function GoalIcon({ icon }: { icon: Goal['icon'] }) {
  if (icon === 'shield') return <Asset name="130b2.svg" size={20} />
  if (icon === 'book') return <Asset name="3eb6a.svg" size={20} />
  if (icon === 'car') return <Asset name="a6782.svg" size={20} />
  const Icon = icon === 'plane' ? Plane : icon === 'target' ? Target : icon === 'book' ? BookOpen : icon === 'car' ? Car : Shield
  return <Icon size={19} strokeWidth={1.5} className="text-white" aria-hidden />
}
