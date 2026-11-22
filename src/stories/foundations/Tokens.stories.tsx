import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ReactNode } from 'react'
import tokens from '../../../tokens/tokens.json'

type Primitive = { name: string; type: 'color' | 'number' | 'string'; value: string | number | number[]; css: string; description: string }
type Semantic = { name: string; alias: string; type: string; scopes: string[]; css: string; description: string }

const primitives = tokens.primitives as Primitive[]
const semantic = tokens.semantic as Semantic[]
const byName = new Map(primitives.map((p) => [p.name, p]))

const show = (p: Primitive) => {
  if (p.type === 'color' && Array.isArray(p.value)) return `rgba(${p.value.join(', ')})`
  return String(p.value)
}
const leaf = (name: string) => name.split('/').pop()!

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="font-sat text-[21px] font-medium tracking-[-0.42px] text-white">{title}</h2>
        {subtitle && <p className="pt-1 font-sat text-[13px] text-esk-muted">{subtitle}</p>}
      </div>
      {children}
    </section>
  )
}

function Code({ children }: { children: ReactNode }) {
  return <code className="font-mono text-[11px] text-esk-subtle">{children}</code>
}

function Swatch({ name, css, value, note }: { name: string; css: string; value: string; note?: string }) {
  return (
    <div className="flex flex-col overflow-hidden rounded-[18px] bg-esk-surface ring-1 ring-esk-track">
      {/* xadrez por baixo para as cores com transparência */}
      <div className="h-[72px] w-full" style={{ backgroundImage: 'repeating-conic-gradient(#2a2a2f 0 25%, #151518 0 50%)', backgroundSize: '16px 16px' }}>
        <div className="size-full" style={{ background: `var(${css})` }} />
      </div>
      <div className="flex flex-col gap-1 p-3">
        <span className="font-sat text-[13px] font-medium text-white">{name}</span>
        <Code>{css}</Code>
        <Code>{value}</Code>
        {note && <span className="font-sat text-[12px] text-esk-muted">{note}</span>}
      </div>
    </div>
  )
}

const Grid = ({ children }: { children: ReactNode }) => <div className="grid grid-cols-[repeat(auto-fill,minmax(180px,1fr))] gap-3">{children}</div>

function Table({ rows, head }: { head: string[]; rows: ReactNode[][] }) {
  return (
    <div className="overflow-x-auto rounded-[18px] ring-1 ring-esk-track">
      <table className="w-full border-collapse text-left font-sat text-[13px]">
        <thead className="bg-esk-surface text-esk-muted">
          <tr>{head.map((h) => <th key={h} className="px-4 py-3 font-medium">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-t border-esk-border">
              {r.map((c, j) => <td key={j} className="px-4 py-2 align-middle text-white">{c}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const meta = {
  title: 'Fundamentos/Tokens',
  parameters: { layout: 'padded' },
} satisfies Meta

export default meta
type Story = StoryObj<typeof meta>

const Wrap = ({ children }: { children: ReactNode }) => <div className="flex max-w-[1200px] flex-col gap-12 p-4">{children}</div>

export const CoresPrimitivas: Story = {
  name: 'Cores — primitivas',
  render: () => {
    const groups = [
      ['Neutros', primitives.filter((p) => p.name.startsWith('color/neutral'))],
      ['Marca e categorias', primitives.filter((p) => p.type === 'color' && !p.name.startsWith('color/neutral') && !p.name.includes('alpha'))],
      ['Transparências', primitives.filter((p) => p.name.includes('alpha'))],
    ] as const
    return (
      <Wrap>
        {groups.map(([title, list]) => (
          <Section key={title} title={title} subtitle="Coleção primitives — valores crus, não use direto nos componentes.">
            <Grid>{list.map((p) => <Swatch key={p.name} name={leaf(p.name)} css={p.css} value={show(p)} />)}</Grid>
          </Section>
        ))}
      </Wrap>
    )
  },
}

export const CoresSemanticas: Story = {
  name: 'Cores — semânticas',
  render: () => {
    const groups = [...new Set(semantic.filter((s) => s.type === 'color').map((s) => s.name.split('/')[1]))]
    return (
      <Wrap>
        {groups.map((g) => (
          <Section key={g} title={g} subtitle="Coleção semantic — cada token é alias de um primitivo.">
            <Grid>
              {semantic
                .filter((s) => s.name.startsWith(`color/${g}/`))
                .map((s) => (
                  <Swatch key={s.name} name={leaf(s.name)} css={s.css} value={`→ ${leaf(s.alias)}`} note={s.description} />
                ))}
            </Grid>
          </Section>
        ))}
      </Wrap>
    )
  },
}

export const Espacamento: Story = {
  name: 'Espaçamento (inclui negativos)',
  render: () => (
    <Wrap>
      <Section title="Primitivos" subtitle="space/space-* — valores negativos aparecem à esquerda do eixo.">
        <Table
          head={['Token', 'Valor', 'CSS', '']}
          rows={primitives
            .filter((p) => p.name.startsWith('space/'))
            .map((p) => {
              const v = p.value as number
              return [
                leaf(p.name),
                `${v}px`,
                <Code>{p.css}</Code>,
                <div className="relative h-[10px] w-[220px]">
                  <span className="absolute top-0 left-1/2 h-full w-px bg-esk-track" />
                  <span
                    className={v < 0 ? 'absolute top-0 h-full rounded-[2px] bg-esk-lilac' : 'absolute top-0 h-full rounded-[2px] bg-esk-lime'}
                    style={v < 0 ? { right: '50%', width: Math.min(110, -v) } : { left: '50%', width: Math.min(110, v) }}
                  />
                </div>,
              ]
            })}
        />
      </Section>
      <Section title="Semânticos">
        <Table
          head={['Token', 'Alias', 'Valor', 'CSS', 'Uso']}
          rows={semantic
            .filter((s) => s.name.startsWith('spacing/'))
            .map((s) => [s.name.replace('spacing/', ''), leaf(s.alias), `${byName.get(s.alias)!.value}px`, <Code>{s.css}</Code>, s.description])}
        />
      </Section>
    </Wrap>
  ),
}

export const Raio: Story = {
  name: 'Raio',
  render: () => (
    <Wrap>
      <Section title="Semânticos" subtitle="Cada quadro usa o raio do token.">
        <Grid>
          {semantic
            .filter((s) => s.name.startsWith('radius/'))
            .map((s) => (
              <div key={s.name} className="flex flex-col gap-2">
                <div className="h-[90px] bg-esk-elevated ring-1 ring-esk-track" style={{ borderRadius: `var(${s.css})` }} />
                <span className="font-sat text-[13px] font-medium">{leaf(s.name)}</span>
                <Code>{`${leaf(s.alias)} · ${byName.get(s.alias)!.value}px`}</Code>
                <span className="font-sat text-[12px] text-esk-muted">{s.description}</span>
              </div>
            ))}
        </Grid>
      </Section>
      <Section title="Primitivos">
        <div className="flex flex-wrap gap-3">
          {primitives
            .filter((p) => p.name.startsWith('radius/'))
            .map((p) => (
              <div key={p.name} className="flex flex-col items-center gap-1">
                <div className="size-[56px] bg-esk-lilac" style={{ borderRadius: Math.min(28, p.value as number) }} />
                <Code>{leaf(p.name).replace('radius-', '')}</Code>
              </div>
            ))}
        </div>
      </Section>
    </Wrap>
  ),
}

const roles = [...new Set(semantic.filter((s) => s.name.split('/').length === 3 && s.name.startsWith('typography/')).map((s) => s.name.split('/')[1]))]
const roleValue = (role: string, prop: string) => {
  const t = semantic.find((s) => s.name === `typography/${role}/${prop}`)
  return t ? byName.get(t.alias)!.value : undefined
}

export const Tipografia: Story = {
  name: 'Tipografia',
  render: () => (
    <Wrap>
      <Section title="Papéis tipográficos" subtitle="typography/<papel>/font-size · font-weight · letter-spacing · font-family">
        <div className="flex flex-col divide-y divide-esk-border rounded-[18px] bg-esk-surface px-5">
          {roles.map((r) => {
            const family = roleValue(r, 'font-family') as string
            const size = roleValue(r, 'font-size') as number
            const weight = roleValue(r, 'font-weight') as number
            const tracking = roleValue(r, 'letter-spacing') as number
            return (
              <div key={r} className="grid grid-cols-[180px_1fr] items-center gap-6 py-4">
                <div className="flex flex-col gap-1">
                  <span className="font-sat text-[13px] font-medium">{r}</span>
                  <Code>{`${family} · ${size}px · ${weight} · ${tracking}px`}</Code>
                </div>
                <span
                  className={r === 'kicker' ? 'uppercase' : ''}
                  style={{ fontFamily: family === 'IBM Plex Mono' ? 'var(--font-mono)' : 'var(--font-sat)', fontSize: size, fontWeight: weight, letterSpacing: tracking }}
                >
                  {r === 'display-money' ? 'R$ 12.480,00' : 'Seu dinheiro, sem susto'}
                </span>
              </div>
            )
          })}
        </div>
      </Section>
      <Section title="Escala de tamanhos (primitivos)">
        <div className="flex flex-col gap-2">
          {primitives
            .filter((p) => p.name.startsWith('font-size/'))
            .map((p) => (
              <div key={p.name} className="flex items-baseline gap-4">
                <span className="w-[40px] shrink-0 font-mono text-[11px] text-esk-subtle">{p.value as number}</span>
                <span style={{ fontSize: p.value as number }} className="font-sat font-medium leading-none">Aa</span>
              </div>
            ))}
        </div>
      </Section>
      <Section title="Pesos, alturas de linha e tracking">
        <Table
          head={['Token', 'Valor', 'CSS']}
          rows={primitives
            .filter((p) => ['font-family/', 'font-weight/', 'line-height/', 'letter-spacing/'].some((g) => p.name.startsWith(g)))
            .map((p) => [p.name, show(p), <Code>{p.css}</Code>])}
        />
      </Section>
    </Wrap>
  ),
}

export const TracoDimensaoEfeitos: Story = {
  name: 'Traço, dimensão, opacidade e movimento',
  render: () => {
    const groups = ['stroke/', 'size/', 'opacity/', 'blur/', 'duration/', 'easing/', 'breakpoint/', 'z-index/']
    return (
      <Wrap>
        <Section title="Traço (stroke)">
          <div className="flex flex-wrap gap-6">
            {primitives
              .filter((p) => p.name.startsWith('stroke/'))
              .map((p) => (
                <div key={p.name} className="flex flex-col items-center gap-2">
                  <div className="h-[40px] w-[80px] rounded-[10px]" style={{ border: `${p.value}px solid #e5ffb5` }} />
                  <Code>{p.value}px</Code>
                </div>
              ))}
          </div>
        </Section>
        <Section title="Primitivos (demais famílias)">
          <Table
            head={['Token', 'Valor', 'CSS', 'Descrição']}
            rows={primitives.filter((p) => groups.some((g) => p.name.startsWith(g))).map((p) => [p.name, show(p), <Code>{p.css}</Code>, p.description])}
          />
        </Section>
        <Section title="Semânticos (demais famílias)">
          <Table
            head={['Token', 'Alias', 'Valor', 'CSS', 'Uso']}
            rows={semantic
              .filter((s) => !s.name.startsWith('color/') && !s.name.startsWith('spacing/') && !s.name.startsWith('radius/') && !s.name.startsWith('typography/'))
              .map((s) => [s.name, leaf(s.alias), show(byName.get(s.alias)!), <Code>{s.css}</Code>, s.description])}
          />
        </Section>
      </Wrap>
    )
  },
}
