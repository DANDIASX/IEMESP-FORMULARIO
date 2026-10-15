import React from 'react'
import { Routes, Route } from 'react-router-dom'
import PublicForm from './pages/PublicForm'
import AdminLogin from './pages/AdminLogin'
import AdminDashboard from './pages/AdminDashboard'
import CheckoutPage from './pages/CheckoutPage'
import PaymentStatusPage from './pages/PaymentStatusPage'
import ProtectedRoute from './components/ProtectedRoute'

export default function App(){
  return (
    <Routes>
      <Route path="/" element={<PublicForm />} />
      <Route path="/checkout/:slug" element={<CheckoutPage />} />
      <Route path="/pagamento/sucesso" element={<PaymentStatusPage />} />
      <Route path="/pagamento/pendente" element={<PaymentStatusPage />} />
      <Route path="/pagamento/erro" element={<PaymentStatusPage />} />
      <Route path="/admin/login" element={<AdminLogin />} />
      <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
    </Routes>
  )
}
