import { useRef } from 'react'
import { Link } from 'react-router-dom'
import { ScrollStage } from '../scroll/ScrollStage'

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
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営</Link>
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
            AIが受けた電話予約が、店舗の台帳へそのまま載る。紙と電話のあいだを、ひとつなぎにします。
          </p>
          <div className="story-actions">
            <Link to="/apply" className="btn btn-primary">
              店舗を申し込む
            </Link>
            <a href="#chapter-phone" className="btn btn-ghost story-scroll-hint">
              スクロールで見る
            </a>
          </div>
        </div>
      </section>

      <section className="story-panel" id="chapter-phone">
        <div className="story-copy story-copy-side">
          <p className="story-kicker">01 / 電話</p>
          <h2>声が、予約の入口になる</h2>
          <p className="story-lead">
            着信から人数・時間・お名前まで。会話の流れをそのまま予約情報へ組み立てます。
          </p>
        </div>
      </section>

      <section className="story-panel" id="chapter-ledger">
        <div className="story-copy story-copy-side is-right">
          <p className="story-kicker">02 / 台帳</p>
          <h2>開いた瞬間、今日の席がわかる</h2>
          <p className="story-lead">
            電話で受けた予約は台帳の一行に。時刻・人数・名前が、いつもの紙台帳の感覚で並びます。
          </p>
        </div>
      </section>

      <section className="story-panel story-end" id="chapter-apply">
        <div className="story-copy story-copy-center">
          <p className="story-kicker">03 / はじめる</p>
          <h2>申し込みは、運営者の承認制</h2>
          <p className="story-lead">
            店舗情報を送ると、運営者が確認してアカウントを発行します。承認後すぐに台帳へ入れます。
          </p>
          <div className="story-actions">
            <Link to="/apply" className="btn btn-primary">
              利用を申し込む
            </Link>
            <Link to="/login" className="btn btn-ghost">
              すでにアカウントがある方
            </Link>
          </div>
          <ol className="story-steps">
            <li>
              <strong>申し込む</strong>
              <span>店舗名と連絡先</span>
            </li>
            <li>
              <strong>承認</strong>
              <span>運営者が確認</span>
            </li>
            <li>
              <strong>ログイン</strong>
              <span>台帳を開く</span>
            </li>
          </ol>
        </div>
      </section>

      <footer className="story-footer">
        <span>よやく台帳</span>
        <Link to="/operator/login">運営者向け</Link>
      </footer>
    </div>
  )
}
