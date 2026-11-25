import { useRef, useState } from 'react'
import { Bell, Bug, Camera, CircleHelp, Download, EyeOff, FileText, KeyRound, Layers, LogOut, RotateCcw, ScrollText, Sparkles, Star } from 'lucide-react'
import { Avatar, Page, PrimaryButton, ScreenHeader, Spinner, Switch } from '../components/ui'
import { OptionGroup, OptionRow } from '../sheets/SettingsSheets'
import { readAvatar } from '../lib/image'
import { toISO } from '../lib/format'
import { TODAY } from '../data/mock'
import { accountApi } from '../services/finance'
import { setDemoAvatar, signOut, updateAccount } from '../services/auth'
import { setToken, USE_SUPABASE } from '../services/http'
import { APP_VERSION } from '../services/settings'
import { useStore } from '../state/store'
import { useMutation } from '../state/useMutation'
import { useUI } from '../state/ui'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="flex flex-col gap-2">
    <h2 className="px-1 font-sat text-[13px] font-medium text-esk-muted">{title}</h2>
    <OptionGroup>{children}</OptionGroup>
  </section>
)

export default function Settings() {
  const { state, dispatch } = useStore()
  const { openSheet, navigate, notify } = useUI()
  const { run, pending } = useMutation()
  const [confirmExit, setConfirmExit] = useState(false)
  const photoInput = useRef<HTMLInputElement>(null)
  const user = state.user
  // Demonstração: conta temporária sem e-mail; segurança e exclusão não se aplicam
  const demo = !!user?.demo
  const plus = state.stage === 2

  async function setPhoto(avatar?: string) {
    if (!user) return
    if (demo) {
      setDemoAvatar(avatar)
      dispatch({ type: 'setAvatar', avatar })
      notify(avatar ? 'Foto atualizada (só nesta demonstração)' : 'Foto do Lucas de volta')
      return
    }
    await run(
      'photo',
      () => accountApi.updateProfile({ avatar }),
      () => {
        dispatch({ type: 'setAvatar', avatar })
        updateAccount({ ...user, avatar })
      },
      avatar ? 'Foto atualizada' : 'Foto removida',
    )
  }

  async function pickPhoto(file?: File) {
    if (!file) return
    try {
      await setPhoto(await readAvatar(file))
    } catch (err) {
      notify((err as Error).message, 'error')
    }
  }

  /** LGPD: a pessoa pode levar os próprios dados. JSON com tudo o que o app guarda dela. */
  function exportData() {
    const { user: u, ...data } = state
    const payload = {
      exportado_em: new Date().toISOString(),
      app: `Okiva ${APP_VERSION}`,
      conta: { nome: u?.name, email: u?.email },
      ...data,
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `okiva-meus-dados-${toISO(TODAY)}.json`
    a.click()
    URL.revokeObjectURL(url)
    notify('Arquivo com seus dados baixado')
  }

  function exit() {
    navigate('home')
    signOut()
    setToken(null)
    dispatch({ type: 'logout' })
  }

  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader title="Conta" />

        <div className="mx-auto flex max-w-[640px] flex-col gap-7 pt-6">
          {/* Perfil */}
          <div className="flex items-center gap-4 rounded-[28px] bg-esk-surface p-5">
            <button type="button" onClick={() => photoInput.current?.click()} aria-label="Trocar foto" disabled={pending === 'photo'} className="group relative shrink-0 rounded-full">
              <Avatar user={user} size={64} />
              {pending === 'photo' && (
                <span className="absolute inset-0 grid animate-fade-in place-items-center rounded-full bg-black/50 text-esk-lime">
                  <Spinner />
                </span>
              )}
              <span className="absolute -right-1 -bottom-1 grid size-[26px] place-items-center rounded-full bg-esk-lime text-esk-ink ring-2 ring-esk-surface transition group-hover:scale-110">
                <Camera size={13} strokeWidth={2} />
              </span>
            </button>
            <div className="min-w-0 flex-1">
              <p className="flex flex-wrap items-center gap-2 font-sat text-[19px] font-medium text-white">
                <span className="truncate">{user?.name}</span>
                {user?.role === 'admin' && (
                  <span className="rounded-full bg-esk-lilac px-2 py-[2px] font-mono text-[10px] font-medium tracking-[0.8px] text-esk-ink" title="Acesso total ao banco de dados">
                    ADMIN
                  </span>
                )}
              </p>
              <p className="truncate font-sat text-[14px] text-esk-muted">{demo ? 'Conta de demonstração' : user?.email}</p>
              <div className="flex flex-wrap gap-x-3 gap-y-1 pt-1">
                <button type="button" onClick={() => openSheet({ type: 'profile' })} className="font-sat text-[13px] font-medium text-esk-lime hover:underline">
                  Editar perfil
                </button>
                {user?.avatar && (
                  <button type="button" onClick={() => setPhoto(undefined)} className="font-sat text-[13px] text-esk-subtle hover:text-white">
                    {demo ? 'Voltar à foto do Lucas' : 'Remover foto'}
                  </button>
                )}
              </div>
            </div>
            <input ref={photoInput} type="file" accept="image/*" className="hidden" onChange={(e) => { pickPhoto(e.target.files?.[0]); e.target.value = '' }} />
          </div>

          <Section title="Plano">
            <OptionRow
              first
              icon={<Sparkles size={17} />}
              label="Seu plano"
              hint={plus ? 'Leitura de fatura e assistente com IA liberados' : 'Assine o Plus para ler faturas e usar o assistente'}
              value={<span className={plus ? 'rounded-full bg-esk-lilac px-2 py-[3px] font-mono text-[10px] tracking-[0.8px] text-esk-ink' : 'text-esk-muted'}>{plus ? 'PLUS' : 'Padrão'}</span>}
              onClick={() => openSheet({ type: 'plan' })}
            />
          </Section>

          <Section title="Preferências">
            <div className="flex items-center gap-3 py-4">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-esk-row text-esk-text-2">
                <EyeOff size={17} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-sat text-[15px] text-white">Ocultar saldo</span>
                <span className="font-sat text-[12px] text-esk-subtle">Esconde os valores ao abrir o app</span>
              </span>
              <Switch label="Ocultar saldo" checked={state.hideBalance} onChange={() => dispatch({ type: 'toggleHide' })} />
            </div>
            <div className="flex items-center gap-3 border-t border-esk-border py-4">
              <span className="grid size-[34px] shrink-0 place-items-center rounded-full bg-esk-row text-esk-text-2">
                <Layers size={17} />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="font-sat text-[15px] text-white">Destacar compras parceladas</span>
                <span className="font-sat text-[12px] leading-[1.35] text-esk-subtle">Resumo do mês e prazos na Home</span>
              </span>
              <Switch
                label="Destacar compras parceladas"
                checked={state.highlightInstallments !== false}
                onChange={() => dispatch({ type: 'toggleInstallments' })}
              />
            </div>
            <OptionRow icon={<Bell size={17} />} label="Notificações" hint="Escolha os avisos que quer receber" onClick={() => openSheet({ type: 'notifications' })} />
          </Section>

          {!demo && USE_SUPABASE && (
            <Section title="Segurança">
              <OptionRow first icon={<KeyRound size={17} />} label="Segurança e login" hint="E-mail, senha, aparelhos conectados e excluir conta" onClick={() => openSheet({ type: 'security' })} />
            </Section>
          )}

          <Section title="Ajuda">
            <OptionRow first icon={<CircleHelp size={17} />} label="Central de ajuda" hint="Perguntas frequentes, mensagem e e-mail" onClick={() => openSheet({ type: 'help' })} />
            <OptionRow icon={<Bug size={17} />} label="Relatar um problema" hint="Algo não funcionou como deveria" onClick={() => openSheet({ type: 'bug' })} />
            <OptionRow icon={<Star size={17} />} label="Avaliar o Okiva" onClick={() => openSheet({ type: 'rate' })} />
          </Section>

          <Section title="Privacidade">
            <OptionRow first icon={<ScrollText size={17} />} label="Política de privacidade" onClick={() => navigate('privacy')} />
            <OptionRow icon={<FileText size={17} />} label="Termos de uso" onClick={() => navigate('terms')} />
            <OptionRow icon={<Download size={17} />} label="Baixar meus dados" hint="Arquivo com tudo o que o Okiva guarda sobre você" onClick={exportData} />
          </Section>

          <Section title="Dados da conta">
            <OptionRow
              first
              danger
              icon={<RotateCcw size={17} />}
              label="Começar do zero"
              hint={demo || !USE_SUPABASE ? 'Apaga os dados desta conta' : 'Apaga todos os dados. Pede sua senha e um código no e-mail.'}
              onClick={() => openSheet({ type: 'verifyAction', action: 'reset' })}
            />
          </Section>

          {confirmExit ? (
            <div className="flex animate-rise flex-col gap-3">
              <p className="font-sat text-[17px] font-medium text-white">{demo ? 'Sair da demonstração?' : 'Deseja sair?'}</p>
              {demo && <p className="-mt-1 font-sat text-[13px] text-esk-subtle">Os dados de exemplo desta visita serão apagados.</p>}
              <div className="grid grid-cols-2 gap-3">
                <PrimaryButton tone="dark" onClick={() => setConfirmExit(false)}>
                  Ficar
                </PrimaryButton>
                <PrimaryButton onClick={exit}>Sair</PrimaryButton>
              </div>
            </div>
          ) : (
            <PrimaryButton tone="danger" onClick={() => setConfirmExit(true)}>
              <LogOut size={17} /> {demo ? 'Sair da demonstração' : 'Sair'}
            </PrimaryButton>
          )}

          <p className="pb-4 text-center font-sat text-[12px] text-esk-subtle">Okiva · versão {APP_VERSION}</p>
        </div>
      </Page>
    </div>
  )
}
