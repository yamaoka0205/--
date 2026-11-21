import { Link } from 'react-router-dom'

function LedgerScreen() {
  return (
    <div className="device-screen" aria-hidden>
      <div className="device-bar">
        <span />
        <span />
        <span />
        <em>今日の予約 · デモ食堂さくら</em>
      </div>
      <div className="device-rows">
        <div className="device-row">
          <time>18:00</time>
          <b>4</b>
          <span>田中 様</span>
          <i>店内</i>
        </div>
        <div className="device-row is-ai">
          <time>18:30</time>
          <b>2</b>
          <span>電話 · 山田</span>
          <i>AI</i>
        </div>
        <div className="device-row">
          <time>19:00</time>
          <b>3</b>
          <span>鈴木 様</span>
          <i>店内</i>
        </div>
        <div className="device-row">
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
    <div className="mk">
      <header className="mk-header">
        <div className="mk-header-inner">
          <Link to="/" className="mk-logo">
            よやく台帳
          </Link>
          <nav className="mk-nav">
            <a href="#problems">解決する課題</a>
            <a href="#features">機能</a>
            <a href="#flow">導入の流れ</a>
            <a href="#faq">よくある質問</a>
            <Link to="/login">ログイン</Link>
            <Link to="/apply" className="mk-cta">
              無料で申し込む
            </Link>
          </nav>
        </div>
      </header>

      <section className="mk-hero">
        <div className="mk-hero-inner">
          <div className="mk-hero-copy">
            <p className="mk-badge">飲食店向け予約・電話管理</p>
            <h1>
              電話の予約を、
              <br />
              台帳にそのまま。
            </h1>
            <p className="mk-hero-lead">
              ピーク時の着信をAIが受け、人数・時間・お名前を台帳の一行に載せます。紙と電話のあいだを、ひとつなぎに。
            </p>
            <div className="mk-hero-actions">
              <Link to="/apply" className="mk-btn mk-btn-primary">
                無料で申し込む
              </Link>
              <a href="#features" className="mk-btn mk-btn-secondary">
                機能を見る
              </a>
            </div>
            <p className="mk-hero-note">初期費用なし · クレジットカード登録不要 · 運営者承認後に利用開始</p>
          </div>
          <div className="mk-hero-visual">
            <img className="mk-hero-photo" src="/media/dining.jpg" alt="" />
            <div className="mk-device is-hero">
              <LedgerScreen />
            </div>
          </div>
        </div>
      </section>

      <section className="mk-section" id="problems">
        <div className="mk-wrap">
          <h2 className="mk-h2">
            こんなお悩みを
            <br />
            よやく台帳が解決します
          </h2>
          <div className="mk-pain-grid">
            <article className="mk-pain">
              <p className="mk-pain-q">ピークの電話対応で、ホールが手薄になる</p>
              <p className="mk-pain-a">AIが着信を受け、台帳へ自動で残します</p>
            </article>
            <article className="mk-pain">
              <p className="mk-pain-q">紙・Excelの転記ミスや読み違いが起きる</p>
              <p className="mk-pain-a">電話も手入力も同じ一覧で管理できます</p>
            </article>
            <article className="mk-pain">
              <p className="mk-pain-q">シフト交代で今夜の席が引き継がれない</p>
              <p className="mk-pain-a">開いた瞬間、今夜の予約が一目でわかります</p>
            </article>
          </div>
        </div>
      </section>

      <section className="mk-section mk-section-alt" id="features">
        <div className="mk-wrap">
          <h2 className="mk-h2">現場が迷わない、今夜の台帳</h2>
          <p className="mk-section-lead">時刻が大きく、人数が丸く、名前が太い。電話予約も手入力も同じ画面です。</p>
          <div className="mk-feature-row">
            <div className="mk-feature-copy">
              <h3>直感的でシンプルな予約一覧</h3>
              <p>
                画面に従ってタッチするだけで、誰でもかんたんに予約を確認・追加できます。AI電話で入った予約も、同じ一覧に並びます。
              </p>
              <ul>
                <li>今日の予約を大きく表示</li>
                <li>電話予約はAIラベルで判別</li>
                <li>人数・時刻・名前が一目でわかる</li>
              </ul>
            </div>
            <div className="mk-device">
              <LedgerScreen />
            </div>
          </div>
          <div className="mk-feature-row is-reverse">
            <div className="mk-feature-copy">
              <h3>電話対応の負荷を下げる</h3>
              <p>
                ピーク時でも着信内容を聞き逃さず、台帳へ残します。ホール接客に集中できる時間をつくります。
              </p>
              <ul>
                <li>AIによる電話予約の取り込み</li>
                <li>転記作業の削減</li>
                <li>二重予約リスクの低減</li>
              </ul>
            </div>
            <div className="mk-photo-frame">
              <img src="/media/phone-counter.jpg" alt="店舗の電話対応のイメージ" />
            </div>
          </div>
        </div>
      </section>

      <section className="mk-section" id="flow">
        <div className="mk-wrap">
          <h2 className="mk-h2">導入までのステップ</h2>
          <ol className="mk-steps">
            <li>
              <span className="mk-step-num">STEP 1</span>
              <strong>フォーム入力</strong>
              <p>店舗名・担当者・メールを送信。クレジットカード登録は不要です。</p>
            </li>
            <li>
              <span className="mk-step-num">STEP 2</span>
              <strong>運営者の承認</strong>
              <p>内容を確認後、アカウントを発行します。</p>
            </li>
            <li>
              <span className="mk-step-num">STEP 3</span>
              <strong>利用開始</strong>
              <p>登録メールでログインし、台帳を使い始められます。</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="mk-section mk-section-alt" id="faq">
        <div className="mk-wrap mk-faq-wrap">
          <h2 className="mk-h2">よくある質問</h2>
          <details className="mk-faq" open>
            <summary>申し込み後、すぐに使えますか？</summary>
            <p>運営者の承認後、登録メールでログインできます。承認は内容確認後に行います。</p>
          </details>
          <details className="mk-faq">
            <summary>クレジットカードは必要ですか？</summary>
            <p>不要です。申し込み時に決済情報の登録はありません。自動課金もありません。</p>
          </details>
          <details className="mk-faq">
            <summary>電話予約と手入力は別画面ですか？</summary>
            <p>同じ台帳一覧に並びます。電話経由はAIラベルで判別できます。</p>
          </details>
          <details className="mk-faq">
            <summary>初期設定は必要ですか？</summary>
            <p>承認後、基本的な台帳・席・営業時間の初期設定が入った状態で開始できます。</p>
          </details>
        </div>
      </section>

      <section className="mk-cta-band">
        <div className="mk-wrap mk-cta-inner">
          <h2>まずは店舗を申し込む</h2>
          <p>承認後、登録メールでログインできます。資料請求ではなく、そのまま申し込みフォームへ進めます。</p>
          <Link to="/apply" className="mk-btn mk-btn-primary">
            無料で申し込む
          </Link>
        </div>
      </section>

      <footer className="mk-footer">
        <div className="mk-wrap mk-footer-inner">
          <span>よやく台帳</span>
          <div>
            <Link to="/login">店舗ログイン</Link>
            <Link to="/operator/login">運営</Link>
          </div>
        </div>
      </footer>
    </div>
  )
}
