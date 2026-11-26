import { FlaskConical } from 'lucide-react'
import { USE_AI_MOCK } from '../services/http'
import { cx } from './ui'

/**
 * Aviso de recurso em demonstração (IA ainda simulada). Some sozinho quando o backend
 * da IA existir (VITE_API_URL definido → USE_AI_MOCK falso). Para tirar de vez:
 * apagar este arquivo e os dois usos (Invoice.tsx e Assistant.tsx).
 */
export function DemoNotice({ children, className }: { children: string; className?: string }) {
  if (!USE_AI_MOCK) return null
  return (
    <div role="note" className={cx('flex items-start gap-3 rounded-[20px] bg-esk-lilac px-4 py-[14px] text-esk-ink', className)}>
      <span className="grid size-[32px] shrink-0 place-items-center rounded-full bg-esk-ink text-esk-lilac">
        <FlaskConical size={17} strokeWidth={1.9} aria-hidden />
      </span>
      <p className="font-sat text-[14px] leading-[1.4]">
        <span className="font-semibold">Em demonstração. </span>
        {children}
      </p>
    </div>
  )
}
