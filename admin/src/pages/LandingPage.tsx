import { Link } from 'react-router-dom'

function LedgerMock({ className = '' }: { className?: string }) {
  return (
    <div className={`ledger-mock ${className}`} aria-hidden>
      <div className="ledger-mock-chrome">
        <span />
        <span />
        <span />
        <em>今日の予約 · デモ食堂さくら</em>
      </div>
      <div className="ledger-mock-rows">
        <div className="ledger-mock-row">
          <time>18:00</time>
          <b>4</b>
          <span>田中 様</span>
          <i>店内</i>
        </div>
        <div className="ledger-mock-row is-phone">
          <time>18:30</time>
          <b>2</b>
          <span>電話 · 山田</span>
          <i>AI</i>
        </div>
        <div className="ledger-mock-row">
          <time>19:00</time>
          <b>3</b>
          <span>鈴木 様</span>
          <i>店内</i>
        </div>
        <div className="ledger-mock-row">
          <time>19:45</time>
          <b>6</b>
          <span>宴会 · 佐藤</span>
          <i>店内</i>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  return (
    <div className="lp">
      <header className="lp-header">
        <div className="lp-header-inner">
          <Link to="/" className="lp-logo">
            よやく台帳
          </Link>
          <nav className="lp-nav">
            <a href="#features">特長</a>
            <a href="#flow">申し込みの流れ</a>
            <Link to="/login">ログイン</Link>
            <Link to="/apply" className="lp-nav-cta">
              無料で申し込む
            </Link>
          </nav>
        </div>
      </header>

      <section className="lp-hero">
        <div className="lp-hero-inner">
          <div className="lp-hero-copy">
            <p className="lp-kicker">飲食店向け · AI電話予約</p>
            <h1 className="lp-brand">よやく台帳</h1>
            <p className="lp-catch">電話の予約を、台帳にそのまま。</p>
            <p className="lp-desc">
              ピーク時の着信をAIが受け、人数・時間・お名前を台帳の一行に載せます。紙と電話のあいだを、ひとつなぎに。
            </p>
            <div className="lp-hero-actions">
              <Link to="/apply" className="btn btn-primary btn-lg">
                無料で申し込む
              </Link>
              <a href="#features" className="btn btn-ghost btn-lg">
                特長を見る
              </a>
            </div>
            <ul className="lp-trust">
              <li>初期費用なし</li>
              <li>運営者承認後に利用開始</li>
              <li>電話予約と手入力を同一一覧</li>
            </ul>
          </div>
          <div className="lp-hero-visual">
            <LedgerMock className="is-hero" />
          </div>
        </div>
      </section>

      <section className="lp-section" id="features">
        <div className="lp-section-inner">
          <header className="lp-section-head">
            <h2>現場が迷わない、今夜の台帳</h2>
            <p>時刻が大きく、人数が丸く、名前が太い。電話予約も手入力も同じ一覧です。</p>
          </header>
          <div className="lp-feature-grid">
            <article>
              <h3>ピークの電話対応をAIが受ける</h3>
              <p>ホールが手薄な時間帯でも、人数・時間・名前を聞き取り、台帳へ自動で残します。</p>
            </article>
            <article>
              <h3>紙・Excelの転記ミスを減らす</h3>
              <p>聞き間違いや二重予約の温床になる手書き転記をやめ、一覧で確認できる形にします。</p>
            </article>
            <article>
              <h3>開いた瞬間、今夜の席がわかる</h3>
              <p>店内予約も電話予約も同じ画面。引き継ぎやシフト交代でも迷いません。</p>
            </article>
          </div>
          <LedgerMock className="is-section" />
        </div>
      </section>

      <section className="lp-section lp-section-alt" id="flow">
        <div className="lp-section-inner">
          <header className="lp-section-head">
            <h2>申し込みから利用まで</h2>
            <p>freeeやマネーフォワードと同様、フォーム送信 → 確認 → 利用開始の流れです。</p>
          </header>
          <ol className="lp-steps">
            <li>
              <strong>1. 申し込む</strong>
              <span>店舗名・担当者・メールを送信</span>
            </li>
            <li>
              <strong>2. 承認</strong>
              <span>運営者が内容を確認</span>
            </li>
            <li>
              <strong>3. ログイン</strong>
              <span>登録メールで台帳を利用開始</span>
            </li>
          </ol>
        </div>
      </section>

      <section className="lp-cta-band">
        <div className="lp-cta-inner">
          <h2>まずは店舗を申し込む</h2>
          <p>承認後、登録メールでログインできます。クレジットカード登録は不要です。</p>
          <Link to="/apply" className="btn btn-primary btn-lg">
            無料で申し込む
          </Link>
        </div>
      </section>

      <footer className="lp-footer">
        <span>よやく台帳</span>
        <div className="lp-footer-links">
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営</Link>
        </div>
      </footer>
    </div>
  )
}
