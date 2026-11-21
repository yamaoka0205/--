import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ScrollStage } from '../scroll/ScrollStage'

export function LandingPage() {
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const onScroll = () => {
      document.querySelector('.sx-nav')?.classList.toggle('is-scrolled', window.scrollY > 40)
    }
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="sx" ref={rootRef}>
      <ScrollStage scrollerRoot={rootRef} />

      <header className="sx-nav">
        <Link to="/" className="sx-brand">
          よやく台帳
        </Link>
        <nav className="sx-links">
          <a href="#vision">構想</a>
          <a href="#features">特長</a>
          <a href="#flow">流れ</a>
          <Link to="/login">ログイン</Link>
          <Link to="/apply" className="sx-pill">
            無料で申し込む
          </Link>
        </nav>
      </header>

      <main className="sx-content">
        <section className="sx-hero">
          <div className="sx-hero-inner" data-reveal>
            <p className="sx-eyebrow">飲食店向け · AI電話予約</p>
            <h1>
              電話の嵐を、<br />
              <em>台帳</em>に。
            </h1>
            <p className="sx-lead">
              ピーク時の着信をAIが受け、人数・時間・お名前を一行に載せる。散らばる予約を、今夜の席の形に。
            </p>
            <dl className="sx-status">
              <div>
                <dt>STATUS</dt>
                <dd>受付中</dd>
              </div>
              <div>
                <dt>CHANNEL</dt>
                <dd>
                  電話 + 店内
                </dd>
              </div>
              <div>
                <dt>LEDGER</dt>
                <dd>同一一覧</dd>
              </div>
              <div>
                <dt>SETUP</dt>
                <dd>承認制</dd>
              </div>
            </dl>
          </div>
          <p className="sx-scroll-cue" aria-hidden>
            SCROLL — 嵐を整える
          </p>
        </section>

        <section className="sx-vision" id="vision">
          <p className="sx-line" data-reveal>
            予約は、メモするものではなく、
          </p>
          <p className="sx-line" data-reveal>
            <span className="sx-accent">つなぐ</span>ものだ。
          </p>
          <p className="sx-line sx-line-small" data-reveal>
            — 電話と紙のあいだに、一本の台帳をひく。
          </p>
        </section>

        <section className="sx-section" id="features">
          <div className="sx-sec-head" data-reveal>
            <p className="sx-eyebrow">FEATURES</p>
            <h2>三段で、今夜を整流する</h2>
            <p className="sx-sec-lead">受けて、載せて、見える。順番を守るだけで、ピークの混乱は目に見えて下がります。</p>
          </div>
          <div className="sx-cards">
            <article className="sx-card" data-reveal>
              <p className="sx-num">01 — RECEIVE</p>
              <h3>
                受信<small>ピークの電話を</small>
              </h3>
              <p>ホールが手薄な時間帯でも、AIが人数・時間・名前を聞き取ります。</p>
            </article>
            <article className="sx-card" data-reveal>
              <p className="sx-num">02 — LEDGER</p>
              <h3>
                台帳<small>一行に載せる</small>
              </h3>
              <p>電話予約も手入力も同じ一覧。転記ミスと二重予約の温床を減らします。</p>
            </article>
            <article className="sx-card" data-reveal>
              <p className="sx-num">03 — TONIGHT</p>
              <h3>
                今夜<small>席が見える</small>
              </h3>
              <p>時刻が大きく、人数が丸く、名前が太い。開いた瞬間、今夜がわかります。</p>
            </article>
          </div>
        </section>

        <section className="sx-section sx-flow" id="flow">
          <div className="sx-sec-head" data-reveal>
            <p className="sx-eyebrow">START</p>
            <h2>申し込みから利用まで</h2>
            <p className="sx-sec-lead">クレジットカード登録は不要。運営者承認後にログインできます。</p>
          </div>
          <ol className="sx-steps">
            <li data-reveal>
              <strong>1. 申し込む</strong>
              <span>店舗名・担当者・メールを送信</span>
            </li>
            <li data-reveal>
              <strong>2. 承認</strong>
              <span>運営者が内容を確認</span>
            </li>
            <li data-reveal>
              <strong>3. ログイン</strong>
              <span>登録メールで台帳を利用開始</span>
            </li>
          </ol>
        </section>

        <section className="sx-cta" id="cta">
          <div data-reveal>
            <h2>まずは店舗を申し込む</h2>
            <p>承認後、登録メールでログイン。自動課金はありません。</p>
            <Link to="/apply" className="sx-pill sx-pill-lg">
              無料で申し込む
            </Link>
          </div>
        </section>
      </main>

      <footer className="sx-foot">
        <span>よやく台帳</span>
        <div>
          <Link to="/login">店舗ログイン</Link>
          <Link to="/operator/login">運営</Link>
        </div>
      </footer>
    </div>
  )
}
