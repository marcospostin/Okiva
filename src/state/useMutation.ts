import { useCallback, useEffect, useRef, useState } from 'react'
import { errorMessage } from '../services/http'
import { useUI } from './ui'

/**
 * Ciclo padrão de toda ação de tela:
 *   botão em "carregando" → chamada ao serviço (mock ou backend) → atualiza o estado → toast.
 * Em erro, o estado não muda, o formulário continua aberto e um toast de erro explica o que houve.
 *
 *   const { run, pending } = useMutation()
 *   run('save', () => cardsApi.create(input), (card) => dispatch({ type: 'saveCard', card }), 'Cartão adicionado')
 */
export function useMutation() {
  const { notify } = useUI()
  const [pending, setPending] = useState<string | null>(null)
  const busy = useRef(false)
  const mounted = useRef(true)
  useEffect(() => {
    mounted.current = true
    return () => {
      mounted.current = false
    }
  }, [])

  const run = useCallback(
    async <T>(
      key: string,
      call: () => Promise<T>,
      apply: (result: T) => void,
      success?: string | ((result: T) => string),
      failure = 'Não deu para salvar. Tente de novo.',
    ): Promise<boolean> => {
      // Double taps never send the same request twice
      if (busy.current) return false
      busy.current = true
      setPending(key)
      try {
        const result = await call()
        apply(result)
        if (success) notify(typeof success === 'function' ? success(result) : success)
        return true
      } catch (err) {
        notify(errorMessage(err, failure), 'error')
        return false
      } finally {
        busy.current = false
        if (mounted.current) setPending(null)
      }
    },
    [notify],
  )

  return { run, pending, busy: pending !== null }
}
