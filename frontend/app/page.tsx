import Link from 'next/link'
import { Icon } from '@/components/Icon'

export default function HomePage() {
  return (
    <div className="home-page">
      <section className="home-hero page-width">
        <div className="hero-copy">
          <h1>
            分身有術，
            <br />
            <em>遇事有路。</em>
          </h1>
          <p className="hero-description">
            把達人的經驗，變成你的神隊友。選一份服務，讓 AI
            帶著過來人的方法，陪你把眼前的問題想清楚。
          </p>
          <Link href="/agents" className="button-primary">
            找我的神隊友
            <Icon />
          </Link>
          <Link href="#how-it-works" className="hero-secondary">
            先看看怎麼使用
          </Link>
        </div>
        <div
          className="hero-ensemble"
          role="img"
          aria-label="一份經驗，化成多個分身，接住不同的需要"
        >
          <svg viewBox="0 0 520 540" aria-hidden="true">
            <path
              className="ensemble-thread"
              d="M40 420 C110 420 80 140 240 140 S340 430 485 310"
            />
            {[0, 1, 2, 3].map((i) => (
              <g className={`ensemble-person ensemble-person-${i}`} key={i}>
                <circle cx="260" cy="175" r="42" />
                <path d="M174 368 V298 C174 188 346 188 346 298 V368" />
              </g>
            ))}
            <path className="ensemble-baseline" d="M44 464 H476" />
          </svg>
        </div>
      </section>

      <section className="possibilities page-width" aria-labelledby="possibilities-title">
        <div className="section-intro">
          <h2 id="possibilities-title">
            旅行、轉職、生活，
            <br />
            經驗各有用武之地。
          </h2>
        </div>
        <div className="scenario-list">
          {[
            ['安排一趟旅行', '帶著一家人的步調，想清楚行程怎麼取捨。', '旅行'],
            ['準備下一份工作', '借用學長姐的方法，整理履歷與面試的思路。', '職涯'],
            ['適應新的生活', '參考過來人的經驗，理解辦事與溝通的眉角。', '生活'],
          ].map(([title, description, tag]) => (
            <div className="scenario-row" key={tag}>
              <span className="scenario-tag">{tag}</span>
              <h3>{title}</h3>
              <p>{description}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="how-it-works" className="how-section">
        <div className="page-width how-layout">
          <div>
            <h2>
              好建議，
              <br />
              從說說你的情況開始。
            </h2>
            <p>
              方法由達人整理，AI 依服務設定提供回應。
              <br />
              你可以接著追問，把問題說得更清楚。
            </p>
            <Link href="/agents" className="text-link">
              探索所有服務
              <Icon />
            </Link>
          </div>
          <ol className="how-steps">
            {[
              ['找一份適合的方法', '看看服務介紹，選擇這次想使用的經驗。'],
              ['說明需求，設定預算', '填寫自己的情況，確認本次服務費用上限。'],
              ['邊聊邊釐清，隨時結束', '補充限制、接著追問；結束後結算，未用預算退回。'],
            ].map(([title, description], i) => (
              <li key={title}>
                <span className="step-number">0{i + 1}</span>
                <div>
                  <h3>{title}</h3>
                  <p>{description}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="creator-invitation page-width">
        <h2>
          換你，成為
          <br />
          別人的過來人。
        </h2>
        <div>
          <p>
            你有一套，就讓經驗多一條出路。
            <br />
            把方法整理成 Skill，讓分身接力服務，也為你帶回收入。
          </p>
          <Link href="/agents/new" className="button-secondary">
            上架我的服務
            <Icon name="plus" />
          </Link>
        </div>
      </section>
    </div>
  )
}
