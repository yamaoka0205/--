import { Link } from 'react-router-dom'

export function LandingPage() {
  return (
    <div className="public-shell">
      <header className="public-top">
        <Link to="/" className="public-logo">
          よやく台帳
        </Link>
        <nav className="public-nav">
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営ログイン</Link>
          <Link to="/apply" className="public-cta-link">
            申し込む
          </Link>
        </nav>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="hero-brand">よやく台帳</p>
          <h1>電話の予約を、台帳にそのまま。</h1>
          <p className="hero-lead">
            AIが電話で受けた予約を、店舗の台帳に自動で載せます。紙と電話のあいだを、ひとつなぎに。
          </p>
          <div className="hero-actions">
            <Link to="/apply" className="btn btn-primary">
              店舗を申し込む
            </Link>
            <Link to="/login" className="btn btn-ghost">
              すでにアカウントがある方
            </Link>
          </div>
        </div>
        <div className="hero-visual" aria-hidden>
          <div className="hero-ledger">
            <div className="hero-ledger-row">
              <span>18:00</span>
              <span>田中 様</span>
              <span>4名</span>
            </div>
            <div className="hero-ledger-row is-phone">
              <span>18:30</span>
              <span>電話予約</span>
              <span>2名</span>
            </div>
            <div className="hero-ledger-row">
              <span>19:00</span>
              <span>鈴木 様</span>
              <span>3名</span>
            </div>
          </div>
        </div>
      </section>

      <section className="public-section">
        <h2>申し込みから利用まで</h2>
        <p className="section-lead">運営者の承認後に、店舗アカウントが使えるようになります。</p>
        <ol className="steps">
          <li>
            <strong>申し込む</strong>
            <span>店舗名と連絡先を送る</span>
          </li>
          <li>
            <strong>承認を待つ</strong>
            <span>運営者が内容を確認</span>
          </li>
          <li>
            <strong>ログイン</strong>
            <span>届いたパスワードで台帳を開く</span>
          </li>
        </ol>
      </section>

      <footer className="public-footer">
        <span>よやく台帳</span>
        <Link to="/operator/login">運営者向け</Link>
      </footer>
    </div>
  )
}
