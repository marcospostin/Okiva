/**
 * Cards de categoria da Home: até 3 lado a lado; acima disso, carrossel com setas.
 */
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { cx } from '../../components/ui'

/** Até 3 cards cabem lado a lado em qualquer largura; acima disso vira carrossel. */
const STATIC_TILES = 3

/**
 * Cards de categoria do mês.
 * - Até 3: grade fixa de 3 colunas (igual ao design original).
 * - Mais de 3: carrossel com rolagem e encaixe (scroll-snap). Mostra ~2,3 cards no
 *   celular e ~3,3 no tablet/desktop: o card cortado na borda indica que há mais.
 *   No celular o carrossel vai até a borda da tela. Com mouse/trackpad (qualquer
 *   largura) aparecem setas; em tela de toque, desliza com o dedo.
 */
export function CategoryTiles({ count, children }: { count: number; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null)
  const [edges, setEdges] = useState({ prev: false, next: true })
  const carousel = count > STATIC_TILES

  const update = useCallback(() => {
    const el = rail.current
    if (!el) return
    setEdges({ prev: el.scrollLeft > 4, next: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 })
  }, [])

  useEffect(() => {
    if (!carousel) return
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [carousel, count, update])

  if (!carousel) return <div className="grid grid-cols-3 gap-3">{children}</div>

  const go = (dir: 1 | -1) => {
    const el = rail.current
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.75, behavior: 'smooth' })
  }

  return (
    <div className="@container relative min-w-0" role="region" aria-roledescription="carrossel" aria-label="Categorias do mês">
      <div
        ref={rail}
        onScroll={update}
        className={cx(
          '-mx-[32px] flex snap-x snap-mandatory scroll-px-[32px] gap-3 overflow-x-auto px-[32px] pb-1 [scrollbar-width:none] md:mx-0 md:scroll-px-0 md:px-0 [&::-webkit-scrollbar]:hidden',
          // Quantos cards cabem depende da largura da coluna (não da tela): ~2.3 até 460px
          // (celular e tablet, onde a coluna é estreita), ~3.3 a partir daí (computador)
          '[&>*]:shrink-0 [&>*]:basis-[calc((100%-12px)/2.3)] [&>*]:snap-start @min-[460px]:[&>*]:basis-[calc((100%-24px)/3.3)]',
        )}
      >
        {children}
      </div>
      {(['prev', 'next'] as const).map((side) => (
        <button
          key={side}
          type="button"
          aria-label={side === 'prev' ? 'Categorias anteriores' : 'Mais categorias'}
          onClick={() => go(side === 'prev' ? -1 : 1)}
          tabIndex={edges[side] ? 0 : -1}
          className={cx(
            // Arrows on any width when there is a mouse/trackpad (hover); touch screens swipe instead
            'absolute top-1/2 hidden size-[36px] -translate-y-1/2 place-items-center rounded-full bg-esk-ink/85 text-white shadow-[0_6px_20px_rgba(0,0,0,0.45)] ring-1 ring-white/10 backdrop-blur transition duration-200 hover:bg-esk-ink [@media(hover:hover)]:grid',
            side === 'prev' ? 'left-[-10px] md:-left-[14px]' : 'right-[-10px] md:-right-[14px]',
            edges[side] ? 'opacity-100' : 'pointer-events-none opacity-0',
          )}
        >
          {side === 'prev' ? <ChevronLeft size={18} strokeWidth={2} /> : <ChevronRight size={18} strokeWidth={2} />}
        </button>
      ))}
    </div>
  )
}
