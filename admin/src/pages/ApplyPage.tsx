import { useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createApplication } from '../api'
import { ScrollStage } from '../scroll/ScrollStage'

export function ApplyPage() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [storeName, setStoreName] = useState('')
  const [contactName, setContactName] = useState('')
  const [contactEmail, setContactEmail] = useState('')
  const [contactPhone, setContactPhone] = useState('')
  const [note, setNote] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [doneId, setDoneId] = useState<string | null>(null)

  async function onSubmit(e: FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    try {
      const res = await createApplication({
        storeName: storeName.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        note: note.trim(),
      })
      setDoneId(res.applicationId)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'failed'
      setError(
        msg === 'invalid_email'
          ? 'メールアドレスの形式を確認してください'
          : msg === 'missing_fields'
            ? '必須項目を入力してください'
            : '申し込みを送れませんでした。時間をおいてもう一度お試しください',
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="story story-apply" ref={rootRef}>
      <ScrollStage scrollerRoot={rootRef} mode="ambient" className="story-stage story-stage-ambient" />

      <header className="story-top">
        <Link to="/" className="story-logo">
          よやく台帳
        </Link>
        <nav className="story-nav">
          <Link to="/">戻る</Link>
          <Link to="/login">ログイン</Link>
        </nav>
      </header>

      <main className="apply-layout">
        <aside className="apply-aside">
          <p className="story-brand apply-brand">よやく台帳</p>
          <h1>店舗の申し込み</h1>
          <p className="story-lead">
            送信後、運営者が確認します。承認されると、登録メールでログインできます。
          </p>
        </aside>

        {doneId ? (
          <div className="apply-form" role="status">
            <h2>受け付けました</h2>
            <p className="story-lead">承認後にメールアドレスでログインできます。</p>
            <p className="muted-note">受付番号: {doneId}</p>
            <Link to="/" className="btn btn-primary">
              トップへ
            </Link>
          </div>
        ) : (
          <form className="apply-form" onSubmit={onSubmit}>
            {error ? <div className="alert alert-error">{error}</div> : null}

            <div className="field">
              <label htmlFor="storeName">店舗名</label>
              <input
                id="storeName"
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                required
                placeholder="食堂さくら"
              />
            </div>
            <div className="field">
              <label htmlFor="contactName">担当者名</label>
              <input
                id="contactName"
                value={contactName}
                onChange={(e) => setContactName(e.target.value)}
                required
              />
            </div>
            <div className="field">
              <label htmlFor="contactEmail">メールアドレス</label>
              <input
                id="contactEmail"
                type="email"
                value={contactEmail}
                onChange={(e) => setContactEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
            <div className="field">
              <label htmlFor="contactPhone">電話番号（任意）</label>
              <input
                id="contactPhone"
                type="tel"
                value={contactPhone}
                onChange={(e) => setContactPhone(e.target.value)}
              />
            </div>
            <div className="field">
              <label htmlFor="note">補足（任意）</label>
              <textarea
                id="note"
                rows={3}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="席数、営業時間など"
              />
            </div>

            <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? '送信中…' : '申し込む'}
            </button>
          </form>
        )}
      </main>
    </div>
  )
}
