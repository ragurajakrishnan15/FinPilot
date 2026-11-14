import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'
import Layout from '@/components/Layout'
import { Loading } from '@/components/States'

// Routes are code-split so the initial bundle stays small (charts load only with the dashboard).
const DashboardPage = lazy(() => import('@/pages/DashboardPage'))
const CommandPage = lazy(() => import('@/pages/CommandPage'))
const TransactionsPage = lazy(() => import('@/pages/TransactionsPage'))
const VendorsPage = lazy(() => import('@/pages/VendorsPage').then((m) => ({ default: m.VendorsPage })))
const VendorDetailPage = lazy(() => import('@/pages/VendorsPage').then((m) => ({ default: m.VendorDetailPage })))
const InvoicesPage = lazy(() => import('@/pages/InvoicesPage'))
const PaymentsPage = lazy(() => import('@/pages/PaymentsPage'))
const ActivityPage = lazy(() => import('@/pages/ActivityPage'))
const SettingsPage = lazy(() => import('@/pages/SettingsPage'))
const AccountsPage = lazy(() => import('@/pages/AccountsPage'))
const NotFoundPage = lazy(() => import('@/pages/NotFoundPage'))

export default function App() {
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<DashboardPage />} />
          <Route path="command" element={<CommandPage />} />
          <Route path="transactions" element={<TransactionsPage />} />
          <Route path="vendors" element={<VendorsPage />} />
          <Route path="vendors/:id" element={<VendorDetailPage />} />
          <Route path="accounts" element={<AccountsPage />} />
          <Route path="invoices" element={<InvoicesPage />} />
          <Route path="payments" element={<PaymentsPage />} />
          <Route path="activity" element={<ActivityPage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
