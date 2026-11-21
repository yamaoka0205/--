import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { createApplication } from '../api'

export function ApplyPage() {
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
    <div className="signup">
      <header className="signup-header">
        <Link to="/" className="lp-logo">
          よやく台帳
        </Link>
        <Link to="/login" className="signup-login">
          すでにアカウントをお持ちの方はログイン
        </Link>
      </header>

      <main className="signup-main">
        <div className="signup-intro">
          <p className="lp-kicker">店舗申し込み</p>
          <h1>よやく台帳を無料で申し込む</h1>
          <p>
            送信内容を運営者が確認し、問題なければアカウントを発行します。承認後、登録メールでログインできます。
          </p>
          <ul>
            <li>クレジットカード登録は不要</li>
            <li>初期設定の台帳・席・営業時間が入ります</li>
            <li>電話予約と手入力を同じ一覧で管理</li>
          </ul>
        </div>

        {doneId ? (
          <div className="signup-card" role="status">
            <h2>受け付けました</h2>
            <p>承認後、メールアドレスでログインできます。</p>
            <p className="muted-note">受付番号: {doneId}</p>
            <Link to="/" className="btn btn-primary" style={{ width: '100%' }}>
              トップへ戻る
            </Link>
          </div>
        ) : (
          <form className="signup-card" onSubmit={onSubmit}>
            <h2>必要事項の入力</h2>
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

            <button type="submit" className="btn btn-primary btn-lg" style={{ width: '100%' }} disabled={submitting}>
              {submitting ? '送信中…' : '申し込む'}
            </button>
            <p className="signup-note">送信後、運営者の承認をお待ちください。自動課金はありません。</p>
          </form>
        )}
      </main>
    </div>
  )
}
