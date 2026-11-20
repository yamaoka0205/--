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

  if (doneId) {
    return (
      <div className="public-shell public-narrow">
        <header className="public-top">
          <Link to="/" className="public-logo">
            よやく台帳
          </Link>
        </header>
        <div className="public-panel">
          <p className="login-eyebrow">申し込み完了</p>
          <h1>受け付けました</h1>
          <p className="login-lead">
            運営者の承認後、ご登録のメールアドレスでログインできるようになります。
          </p>
          <p className="muted-note">受付番号: {doneId}</p>
          <Link to="/" className="btn btn-primary">
            トップへ戻る
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="public-shell public-narrow">
      <header className="public-top">
        <Link to="/" className="public-logo">
          よやく台帳
        </Link>
        <Link to="/login">店舗ログイン</Link>
      </header>

      <form className="public-panel" onSubmit={onSubmit}>
        <p className="login-eyebrow">店舗申し込み</p>
        <h1>利用を申し込む</h1>
        <p className="login-lead">内容を確認したうえで、運営者がアカウントを発行します。</p>

        {error ? <div className="alert alert-error">{error}</div> : null}

        <div className="field">
          <label htmlFor="storeName">店舗名</label>
          <input
            id="storeName"
            value={storeName}
            onChange={(e) => setStoreName(e.target.value)}
            required
            placeholder="例：食堂さくら"
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
            placeholder="席数や営業時間など、伝えたいことがあれば"
          />
        </div>

        <button type="submit" className="btn btn-primary" style={{ width: '100%' }} disabled={submitting}>
          {submitting ? '送信中…' : '申し込む'}
        </button>
      </form>
    </div>
  )
}
