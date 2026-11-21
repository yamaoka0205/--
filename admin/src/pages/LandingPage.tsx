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
  const rootRef = useRef<HTMLDivElement>(null)

  return (
    <div className="site" ref={rootRef}>
      <ScrollStage scrollerRoot={rootRef} mode="story" className="site-stage" />

      <header className="site-top">
        <Link to="/" className="site-logo">
          よやく台帳
        </Link>
        <nav className="site-nav">
          <a href="#problem">課題</a>
          <a href="#product">画面</a>
          <Link to="/login">ログイン</Link>
          <Link to="/apply" className="site-nav-cta">
            申し込む
          </Link>
        </nav>
      </header>

      <section className="site-hero">
        <div className="site-hero-copy">
          <p className="site-eyebrow">飲食店向け · AI電話予約</p>
          <h1 className="site-brand">よやく台帳</h1>
          <p className="site-headline">電話の予約を、台帳にそのまま。</p>
          <p className="site-lead">
            ピーク時の着信をAIが受け、人数・時間・お名前を台帳の一行に載せます。紙と電話のあいだを、ひとつなぎに。
          </p>
          <div className="site-actions">
            <Link to="/apply" className="btn btn-primary">
              無料で申し込む
            </Link>
            <a href="#product" className="btn btn-ghost">
              画面を見る
            </a>
          </div>
        </div>
      </section>

      <section className="site-band" id="problem">
        <div className="site-band-inner">
          <h2>電話対応で、接客が止まる</h2>
          <p className="site-lead">
            紙やExcelの台帳だと、聞き間違い・二重予約・引き継ぎ漏れが起きやすい。よやく台帳は着信内容をその場で一覧に残します。
          </p>
          <ul className="site-pains">
            <li>ピークの電話対応でホールが手薄になる</li>
            <li>紙台帳の転記ミス・読み違い</li>
            <li>電話予約と手入力が別管理になる</li>
          </ul>
        </div>
      </section>

      <section className="site-product" id="product">
        <div className="site-product-copy">
          <h2>開いた瞬間、今夜の席がわかる</h2>
          <p className="site-lead">
            電話予約も手入力も同じ一覧。時刻が大きく、人数が丸く、名前が太い。現場が迷わない見え方にしています。
          </p>
        </div>
        <LedgerProof />
      </section>

      <section className="site-flow">
        <div className="site-flow-inner">
          <h2>申し込みから利用まで</h2>
          <p className="site-lead">運営者の承認制です。内容を確認してからアカウントを発行します。</p>
          <div className="site-flow-steps">
            <div>
              <strong>申し込む</strong>
              <span>店舗名と連絡先を送る</span>
            </div>
            <div>
              <strong>承認</strong>
              <span>運営者が内容を確認</span>
            </div>
            <div>
              <strong>ログイン</strong>
              <span>台帳をすぐ使える</span>
            </div>
          </div>
        </div>
      </section>

      <section className="site-cta">
        <h2>まずは店舗を申し込む</h2>
        <p className="site-lead">承認後、登録メールでログインできます。</p>
        <Link to="/apply" className="btn btn-primary">
          申し込みフォームへ
        </Link>
      </section>

      <footer className="site-footer">
        <span>よやく台帳</span>
        <div className="site-footer-links">
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営</Link>
        </div>
      </footer>
    </div>
  )
}
