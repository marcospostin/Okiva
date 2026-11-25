import { Page, ScreenHeader } from '../components/ui'
import { SUPPORT_EMAIL } from '../services/settings'

/**
 * Política de privacidade e Termos de uso.
 * RASCUNHO: revisar com um advogado antes do lançamento e preencher os dados entre [colchetes]
 * (razão social, CNPJ, endereço e o e-mail do encarregado de dados / DPO).
 */
const UPDATED = '24 de novembro de 2026'

type Block = { h: string; p: string[] }

const PRIVACY: Block[] = [
  {
    h: 'Quem somos',
    p: [
      `O Okiva é um aplicativo de organização financeira pessoal mantido por [razão social], CNPJ [número], [endereço]. Para falar sobre privacidade, escreva para ${SUPPORT_EMAIL} (encarregado de dados: [nome]).`,
    ],
  },
  {
    h: 'Quais dados coletamos',
    p: [
      'Dados de cadastro: nome, e-mail, senha (guardada de forma criptografada, nunca em texto) e foto de perfil, se você enviar.',
      'Dados que você registra: gastos, receitas, contas, cartões (apelido, final de 4 dígitos, limite e fatura), metas, tetos, categorias e faturas que você envia para leitura.',
      'Dados técnicos: versão do app, navegador e tamanho da tela quando você relata um problema, e registros de acesso necessários para segurança.',
      'Não pedimos senha de banco, número completo de cartão nem acesso à sua conta bancária.',
    ],
  },
  {
    h: 'Para que usamos',
    p: [
      'Para mostrar seus gastos, saldos, tetos e metas e calcular os avisos que você escolheu.',
      'Para ler faturas e responder no assistente (Okiva Plus), usando só os seus dados e números agregados.',
      'Para manter a conta segura (login, confirmação de e-mail, recuperação de senha) e responder pedidos de suporte.',
      'Não vendemos seus dados e não os usamos para publicidade de terceiros.',
    ],
  },
  {
    h: 'Base legal (LGPD)',
    p: [
      'Execução do contrato (prestar o serviço que você pediu), cumprimento de obrigação legal, legítimo interesse para segurança e prevenção de fraude, e consentimento para comunicações de novidades, que você pode retirar a qualquer momento em Conta → Notificações.',
    ],
  },
  {
    h: 'Com quem compartilhamos',
    p: [
      'Somente com fornecedores que operam o serviço em nosso nome, sob contrato: hospedagem do banco de dados e autenticação (Supabase), hospedagem do site (Vercel) e, no Okiva Plus, o provedor de IA que lê faturas e responde o assistente.',
      'Podemos compartilhar dados se uma lei ou ordem judicial exigir.',
    ],
  },
  {
    h: 'Onde e por quanto tempo guardamos',
    p: [
      'Os dados ficam em servidores com criptografia em trânsito e acesso restrito: cada pessoa só acessa os próprios dados.',
      'Guardamos enquanto sua conta existir. Ao excluir a conta, os dados são apagados, exceto o que a lei obrigar a manter.',
    ],
  },
  {
    h: 'Seus direitos',
    p: [
      'Você pode acessar, corrigir e levar seus dados (Conta → Baixar meus dados), apagar tudo (Conta → Começar do zero) ou excluir a conta (Segurança e login → Excluir conta), além de pedir informações sobre o uso e revogar consentimentos.',
      `Para qualquer outro pedido, escreva para ${SUPPORT_EMAIL}. Você também pode procurar a ANPD.`,
    ],
  },
  {
    h: 'Mudanças nesta política',
    p: ['Quando houver mudança importante, avisaremos no app antes de ela valer.'],
  },
]

const TERMS: Block[] = [
  {
    h: 'Aceite',
    p: ['Ao criar uma conta ou usar o Okiva, você concorda com estes termos e com a Política de privacidade.'],
  },
  {
    h: 'O que o Okiva faz',
    p: [
      'O Okiva ajuda a registrar gastos e receitas, acompanhar cartões, contas, tetos e metas. Ele não é banco, não movimenta dinheiro e não faz pagamentos.',
      'Os números exibidos dependem do que você registra. Sugestões do assistente são informativas e não são recomendação de investimento.',
    ],
  },
  {
    h: 'Sua conta',
    p: [
      'Você é responsável por manter sua senha em segredo e pelas informações que registra. Avise o suporte se suspeitar de acesso indevido.',
      'É preciso ter 18 anos ou mais, ou autorização do responsável legal.',
    ],
  },
  {
    h: 'Okiva Plus',
    p: [
      'Recursos de IA fazem parte do plano Plus. Preço, forma de pagamento, renovação e cancelamento serão informados antes da assinatura. Você pode cancelar quando quiser em Conta → Seu plano; os recursos ficam disponíveis até o fim do período pago.',
    ],
  },
  {
    h: 'Uso permitido',
    p: ['Não use o app para fins ilegais, para tentar acessar dados de outras pessoas ou para prejudicar o serviço.'],
  },
  {
    h: 'Disponibilidade e responsabilidade',
    p: [
      'Trabalhamos para manter o serviço disponível e seguro, mas podem ocorrer interrupções. Não nos responsabilizamos por decisões financeiras tomadas com base em dados registrados incorretamente.',
    ],
  },
  {
    h: 'Encerramento',
    p: ['Você pode excluir sua conta a qualquer momento. Podemos suspender contas que violem estes termos.'],
  },
  {
    h: 'Lei e foro',
    p: ['Estes termos seguem a lei brasileira, incluindo o Código de Defesa do Consumidor e a LGPD. Foro: [cidade/UF].'],
  },
]

export default function Legal({ doc }: { doc: 'privacy' | 'terms' }) {
  const blocks = doc === 'privacy' ? PRIVACY : TERMS
  return (
    <div className="min-h-[calc(100dvh-var(--tabbar-space,0px))] bg-esk-bg-2">
      <Page>
        <ScreenHeader title={doc === 'privacy' ? 'Privacidade' : 'Termos de uso'} />
        <article className="mx-auto flex max-w-[680px] flex-col gap-6 pt-6 pb-10">
          <p className="font-sat text-[13px] text-esk-subtle">Atualizado em {UPDATED}</p>
          {blocks.map((b, i) => (
            <section key={b.h} className="flex flex-col gap-2">
              <h2 className="font-sat text-[18px] font-medium text-white">
                {i + 1}. {b.h}
              </h2>
              {b.p.map((p) => (
                <p key={p} className="font-sat text-[15px] leading-[1.6] text-esk-muted">
                  {p}
                </p>
              ))}
            </section>
          ))}
        </article>
      </Page>
    </div>
  )
}
