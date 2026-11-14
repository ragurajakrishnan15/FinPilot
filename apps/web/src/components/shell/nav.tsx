import {
  ArrowLeftRight,
  Banknote,
  Building2,
  FileText,
  Landmark,
  LayoutGrid,
  MessageSquare,
  ScrollText,
  Settings2,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  end?: boolean
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

// One icon set (lucide), one size, one stroke: applied where these render (size-4, strokeWidth 1.5).
export const navGroups: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutGrid, end: true },
      { to: '/command', label: 'Command', icon: MessageSquare },
    ],
  },
  {
    label: 'Money',
    items: [
      { to: '/accounts', label: 'Accounts', icon: Landmark },
      { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
      { to: '/vendors', label: 'Vendors', icon: Building2 },
      { to: '/invoices', label: 'Invoices', icon: FileText },
      { to: '/payments', label: 'Payments', icon: Banknote },
    ],
  },
  {
    label: 'Workspace',
    items: [
      { to: '/activity', label: 'Activity', icon: ScrollText },
      { to: '/settings', label: 'Settings', icon: Settings2 },
    ],
  },
]

export const suggestedPrompts = [
  'What is our current total account balance?',
  'Compare AWS expenses in September and October',
  'Which five vendors received the most money this quarter?',
  'Show invoices due in the next 14 days',
  'What was our net cash flow last month?',
  'Prepare a $500 payment to ABC Vendors with the memo "October services"',
]
