import { useUI, type SheetState } from '../state/ui'
import { BugReportSheet, ChangeEmailSheet, ChangePasswordSheet, HelpSheet, NotificationsSheet, PlanSheet, ProfileSheet, RateSheet, SecuritySheet, VerifyActionSheet } from './SettingsSheets'
import { AnticipateSheet, BankAccountSheet, CapAlertSheet, CategorizeSheet, ReportDetailSheet, EditEntrySheet, EntrySheet, OngoingInstallmentSheet, PayInvoiceSheet, ReconcileSheet, TransferSheet, RecurrenceSheet, TransactionSheet } from './MoneySheets'
import { CardSheet, InvoiceImportSheet } from './host/cards'
import { DepositSheet, GoalSheet, SaveSheet } from './host/goals'
import { BudgetSheet, CapSheet, CategoriesSheet, CategorySheet } from './host/budget'
import { BalanceSheet, PlusSheet } from './host/misc'

/** Cada abertura de sheet ganha um número: reabrir (mesmo do mesmo tipo) começa o formulário do zero. */
const sheetIds = new WeakMap<SheetState, number>()

let nextSheetId = 0

const sheetKey = (s: SheetState) => {
  let id = sheetIds.get(s)
  if (id === undefined) sheetIds.set(s, (id = ++nextSheetId))
  return id
}

export default function SheetHost() {
  const { sheet, closeSheet } = useUI()
  if (!sheet) return null
  // Sem a chave, salvar um gasto e tocar "+" logo em seguida abria o formulário com os dados anteriores
  return <SheetSwitch key={sheetKey(sheet)} sheet={sheet} close={closeSheet} />
}

function SheetSwitch({ sheet, close }: { sheet: SheetState; close: () => void }) {
  switch (sheet.type) {
    case 'add':
      return <EntrySheet close={close} initialKind={sheet.kind} />
    case 'edit':
      return <EditEntrySheet close={close} id={sheet.id} />
    case 'anticipate':
      return <AnticipateSheet close={close} group={sheet.group} />
    case 'ongoing':
      return <OngoingInstallmentSheet close={close} id={sheet.id} cardId={sheet.cardId} />
    case 'payInvoice':
      return <PayInvoiceSheet close={close} cardId={sheet.cardId} id={sheet.id} />
    case 'bankAccount':
      return <BankAccountSheet close={close} id={sheet.id} parentId={sheet.parentId} />
    case 'transfer':
      return <TransferSheet close={close} id={sheet.id} from={sheet.from} to={sheet.to} />
    case 'reconcile':
      return <ReconcileSheet close={close} accountId={sheet.accountId} cardId={sheet.cardId} />
    case 'recurrence':
      return <RecurrenceSheet close={close} id={sheet.id} />
    case 'reportDetail':
      return <ReportDetailSheet close={close} title={sheet.title} subtitle={sheet.subtitle} ids={sheet.ids} category={sheet.category} />
    case 'categorize':
      return <CategorizeSheet close={close} id={sheet.id} />
    case 'capAlert':
      return <CapAlertSheet close={close} category={sheet.category} />
    case 'tx':
      return <TransactionSheet close={close} id={sheet.id} />
    case 'card':
      return <CardSheet close={close} id={sheet.id} />
    case 'goal':
      return <GoalSheet close={close} id={sheet.id} />
    case 'save':
      return <SaveSheet close={close} goalId={sheet.goalId} />
    case 'budget':
      return <BudgetSheet close={close} category={sheet.category} />
    case 'cap':
      return <CapSheet close={close} />
    case 'balance':
      return <BalanceSheet close={close} />
    case 'plan':
      return <PlanSheet close={close} />
    case 'security':
      return <SecuritySheet close={close} />
    case 'changeEmail':
      return <ChangeEmailSheet />
    case 'changePassword':
      return <ChangePasswordSheet close={close} />
    case 'newPassword':
      return <ChangePasswordSheet recovery close={close} />
    case 'notifications':
      return <NotificationsSheet close={close} />
    case 'help':
      return <HelpSheet close={close} />
    case 'bug':
      return <BugReportSheet close={close} />
    case 'rate':
      return <RateSheet close={close} />
    case 'verifyAction':
      return <VerifyActionSheet close={close} action={sheet.action} confirmed={sheet.confirmed} />
    case 'plus':
      return <PlusSheet close={close} then={sheet.then} />
    case 'profile':
      return <ProfileSheet close={close} />
    case 'deposit':
      return <DepositSheet close={close} id={sheet.id} />
    case 'categories':
      return <CategoriesSheet close={close} />
    case 'category':
      return <CategorySheet close={close} id={sheet.id} />
    case 'invoiceImport':
      return <InvoiceImportSheet close={close} id={sheet.id} />
  }
}

/* ------------------------------------------------- Novo / editar cartão */
