import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ScrollStage } from '../scroll/ScrollStage'

function LedgerProof() {
  return (
    <div className="proof-device" aria-hidden>
      <div className="proof-chrome">
        <span />
        <span />
        <span />
        <em>今日の予約 · デモ食堂さくら</em>
      </div>
      <div className="proof-rows">
        <div className="proof-row">
          <time>18:00</time>
          <b>4</b>
          <span>田中 様</span>
          <i>店内</i>
        </div>
        <div className="proof-row is-phone">
          <time>18:30</time>
          <b>2</b>
          <span>電話 · 山田</span>
          <i>AI</i>
        </div>
        <div className="proof-row">
          <time>19:00</time>
          <b>3</b>
          <span>鈴木 様</span>
          <i>店内</i>
        </div>
        <div className="proof-row">
          <time>19:30</time>
          <b>5</b>
          <span>佐藤 様</span>
          <i>店内</i>
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div className="story" ref={rootRef}>
      <ScrollStage scrollerRoot={rootRef} mode="story" />

      <header className="story-top">
        <Link to="/" className="story-logo">
          よやく台帳
        </Link>
        <nav className="story-nav">
          <Link to="/login">ログイン</Link>
          <Link to="/apply" className="story-nav-cta">
            申し込む
          </Link>
        </nav>
      </header>

      <section className="story-panel story-hero">
        <div className="story-copy">
          <p className="story-brand">よやく台帳</p>
          <h1>電話の予約を、台帳にそのまま。</h1>
          <p className="story-lead">
            AIが受けた予約が、店舗の台帳へ載る。紙と電話のあいだを、ひとつなぎに。
          </p>
          <div className="story-actions">
            <Link to="/apply" className="btn btn-primary">
              店舗を申し込む
            </Link>
            <Link to="/login" className="btn btn-ghost">
              ログイン
            </Link>
          </div>
        </div>
      </section>

      <section className="story-panel story-panel-quiet">
        <div className="story-copy story-copy-narrow">
          <h2>着信の内容が、今日の一行になる</h2>
          <p className="story-lead">
            人数、時間、お名前。会話のまま予約情報へ。取りこぼしを、台帳側で防ぐ。
          </p>
        </div>
      </section>

      <section className="story-panel story-panel-proof">
        <div className="story-proof-grid">
          <div className="story-copy story-copy-narrow">
            <h2>開いた瞬間、今夜の席がわかる</h2>
            <p className="story-lead">
              電話予約も手入力も、同じ一覧に並ぶ。時刻が大きく、人数が丸く、名前が太い。
            </p>
          </div>
          <LedgerProof />
        </div>
      </section>

      <section className="story-panel story-end">
        <div className="story-copy story-copy-center">
          <h2>店の準備ができたら、申し込む</h2>
          <p className="story-lead">
            運営者が内容を確認し、アカウントを発行します。承認後すぐに台帳を使えます。
          </p>
          <div className="story-actions story-actions-center">
            <Link to="/apply" className="btn btn-primary">
              利用を申し込む
            </Link>
          </div>
        </div>
      </section>

      <footer className="story-footer">
        <span>よやく台帳</span>
        <div className="story-footer-links">
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営</Link>
        </div>
      </footer>
    </div>
  )
}
