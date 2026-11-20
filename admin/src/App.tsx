import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { LedgerPage } from './pages/LedgerPage'
import { SettingsPage } from './pages/SettingsPage'

export default function App() {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <div className="app-shell">
      <nav className="nav" aria-label="メインメニュー">
        <div className="nav-brand">
          予約
          <br />
          台帳
        </div>
        <NavLink to="/" end className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <span className="icon" aria-hidden>
            ▣
          </span>
          予約
        </NavLink>
        <NavLink to="/settings" className={({ isActive }) => (isActive ? 'active' : undefined)}>
          <span className="icon" aria-hidden>
            ⚙
          </span>
          設定
        </NavLink>
      </nav>

      <main className="main">
        <Routes>
          <Route path="/" element={<LedgerPage onToast={setToast} />} />
          <Route path="/settings" element={<SettingsPage onToast={setToast} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      {toast ? (
        <div className="success-toast" role="status">
          <div className="success-card">
            <div className="check">✓</div>
            <h3>登録しました</h3>
            <p>{toast}</p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
