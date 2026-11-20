import { useEffect, useState } from 'react'
import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { LedgerPage } from './pages/LedgerPage'
import { LoginPage } from './pages/LoginPage'
import { SettingsPage } from './pages/SettingsPage'

function Protected({ children }: { children: React.ReactNode }) {
  const { loading, session } = useAuth()
  if (loading) {
    return (
      <div className="login-page">
        <div className="login-card">読み込み中…</div>
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

function Shell({ onToast }: { onToast: (message: string) => void }) {
  const { session, logout } = useAuth()
  const [loggingOut, setLoggingOut] = useState(false)

  async function onLogout() {
    setLoggingOut(true)
    try {
      await logout()
    } finally {
      setLoggingOut(false)
    }
  }

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
        <div className="nav-footer">
          <div className="nav-user" title={session?.email}>
            {session?.displayName || 'ユーザー'}
          </div>
          <button type="button" className="nav-logout" onClick={() => void onLogout()} disabled={loggingOut}>
            {loggingOut ? '…' : 'ログアウト'}
          </button>
        </div>
      </nav>

      <main className="main">
        <Routes>
          <Route path="/" element={<LedgerPage onToast={onToast} />} />
          <Route path="/settings" element={<SettingsPage onToast={onToast} />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 1600)
    return () => window.clearTimeout(t)
  }, [toast])

  return (
    <AuthProvider>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <Protected>
              <Shell onToast={setToast} />
            </Protected>
          }
        />
      </Routes>

      {toast ? (
        <div className="success-toast" role="status">
          <div className="success-card">
            <div className="check">✓</div>
            <h3>登録しました</h3>
            <p>{toast}</p>
          </div>
        </div>
      ) : null}
    </AuthProvider>
  )
}
