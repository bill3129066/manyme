import Link from 'next/link'
import { Icon } from '@/components/Icon'

export default function HomePage() {
  return <div className="home-page">
    <section className="home-hero page-width">
      <div className="hero-copy">
        <h1>你的難題，<br /><em>有人走過。</em></h1>
        <p className="hero-description">把過來人的經驗，<br className="sm:hidden" />用在你自己的情況。</p>
        <p className="hero-support">選一份達人整理的方法，透過 AI 說明需求、追問細節。從日常到人生轉彎的地方，找到下一步。</p>
        <Link href="/agents" className="button-primary">找找適合我的服務<Icon /></Link>
        <Link href="#how-it-works" className="hero-secondary">先看看怎麼使用</Link>
      </div>
      <div className="experience-note">
        <div className="note-top"><span>每個人的情況，都值得好好想。</span><Icon name="plus" /></div>
        <div className="note-scenario"><span>旅行這件事</span><h2>攻略我看過了，<br />但我家不是<br />範例家庭。</h2></div>
        <div className="note-question"><p>「帶爸媽和小孩出門，<br />不開車，也不想天天換飯店。」</p><span>從你的條件開始說。</span></div>
        <div className="note-bottom"><span>一個使用情境</span><span>經驗，接著用。</span></div>
      </div>
    </section>

    <section className="possibilities page-width" aria-labelledby="possibilities-title">
      <div className="section-intro"><h2 id="possibilities-title">生活裡的大小題，<br />都能從經驗找線索。</h2><p>你正在摸索的事，<br />也許正是某位過來人熟悉的日常。</p></div>
      <div className="scenario-list">
        {[['安排一趟旅行','帶著一家人的步調，想清楚行程怎麼取捨。','旅行'],['準備下一份工作','借用學長姐的方法，整理履歷與面試的思路。','職涯'],['適應新的生活','參考過來人的經驗，理解辦事與溝通的眉角。','生活']].map(([title,description,tag]) => <div className="scenario-row" key={tag}><span className="scenario-tag">{tag}</span><h3>{title}</h3><p>{description}</p></div>)}
      </div>
      <p className="section-footnote">以上為使用情境，實際可用內容以市集已上架的服務為準。</p>
    </section>

    <section id="how-it-works" className="how-section">
      <div className="page-width how-layout"><div><h2>好建議，<br />從說說你的情況開始。</h2><p>方法由達人整理，AI 依服務設定提供回應。<br />你可以接著追問，把問題說得更清楚。</p><Link href="/agents" className="text-link">探索所有服務<Icon /></Link></div><ol className="how-steps">{[['找一份適合的方法','看看服務介紹，選擇這次想使用的經驗。'],['說明需求，設定預算','填寫自己的情況，確認本次服務費用上限。'],['邊聊邊釐清，隨時結束','補充限制、接著追問；結束後結算，未用預算退回。']].map(([title,description],i) => <li key={title}><span className="step-number">0{i+1}</span><div><h3>{title}</h3><p>{description}</p></div></li>)}</ol></div>
    </section>

    <section className="creator-invitation page-width"><p>換你，成為別人的過來人。</p><div><h2>你的經驗，<br />有人正好需要。</h2><p>把判斷方法與案例整理成服務。<br />讓經驗被使用，也為自己累積收入。</p><Link href="/agents/new" className="button-secondary">上架我的服務<Icon name="plus" /></Link></div></section>
  </div>
}
