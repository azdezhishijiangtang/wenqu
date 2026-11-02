import { Atom, Bot, ExternalLink, Heart, HandCoins, Sigma, Sparkles, Video } from 'lucide-react'

interface Props {
  onOpenDonate: () => void
  onOpenCustom: () => void
}

const interests = [
  {
    icon: Sigma,
    title: '热爱数学',
    desc: '从函数与导数到圆锥曲线，相信每一个公式背后都有值得讲述的故事，也愿意把它讲得人人能懂。',
  },
  {
    icon: Atom,
    title: '热爱物理',
    desc: '从受力分析到电磁感应，痴迷于用最简洁的原理描述最复杂的自然现象。',
  },
  {
    icon: Bot,
    title: '热爱 AI',
    desc: '探索人工智能与教育的结合，用 AI 让答疑更即时、让学习更个性化。',
  },
]

export function AboutView({ onOpenDonate, onOpenCustom }: Props) {
  return (
    <div className="about-page">
      <header className="page-head">
        <p className="eyebrow">ABOUT THE DEVELOPER</p>
        <h1>关于开发者</h1>
        <p className="page-sub">问渠是谁做的，为什么做，以及你可以怎么参与。</p>
      </header>

      <section className="dev-card">
        <span className="dev-avatar" aria-hidden="true">
          <Video size={26} />
        </span>
        <div>
          <h2>阿z的知识讲堂</h2>
          <p className="dev-role">B 站 UP 主 · 数理知识科普与讲解创作者</p>
          <p>
            大家好，我是 B 站 UP 主<strong>「阿z的知识讲堂」</strong>，一个热爱数学、物理与 AI
            的创作者。问渠是我把课堂讲解继续往前推的一步——不满足于「讲一遍」，而是希望你带着自己的题来，
            随时问、随时有人接住。
          </p>
          <p>
            这里没有账号体系强制注册，没有广告，也不收集你的题目。你填自己的 API Key，
            用自己的模型，剩下的交给这个页面。
          </p>
        </div>
      </section>

      <section className="interest-grid" aria-label="开发者的三个热爱">
        {interests.map(({ icon: Icon, title, desc }) => (
          <div className="interest-card" key={title}>
            <span className="interest-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </section>

      <section className="bili-card">
        <span className="bili-mark" aria-hidden="true">
          <Video size={22} />
        </span>
        <div className="bili-copy">
          <h2>B 站：阿z的知识讲堂</h2>
          <p>
            网站的最新进展、新上线的项目，以及数学物理的学科知识讲解，我都会第一时间发在 B 站。
            网站只是其中一部分，想看更完整的更新节奏和讲解视频，欢迎来我的空间逛逛。
          </p>
          <p className="bili-sub">关注一下，等于订阅了这个网站接下来会长成什么样子。</p>
        </div>
        <a
          className="bili-button"
          href="https://b23.tv/E9ZSgYS"
          target="_blank"
          rel="noopener noreferrer"
        >
          <Video size={16} /> 去 B 站关注
          <ExternalLink size={14} />
        </a>
      </section>

      <section className="guide-section">
        <h2>
          <Sparkles size={18} /> 我的心愿：免费的关注就是最大的鼓励
        </h2>
        <p>
          做内容不易，但我最大的心愿其实很简单——<strong>希望得到大家免费的关注</strong>。如果你还没关注
          我的 B 站账号，点上面的按钮去
          <a href="https://b23.tv/E9ZSgYS" target="_blank" rel="noopener noreferrer">
            「阿z的知识讲堂」
          </a>
          点个关注就好，你的每一次关注都是我继续更新课程与网站的动力。
        </p>
        <p>
          如果这个网站对你真的很有帮助，也可以选择给我打赏，请根据自身情况量力而行——
          <strong>如果你喜欢白嫖，开发者也完全不介意哦</strong>。知识本就应该自由流动，能帮到你，我就很开心了。
        </p>
      </section>

      <div className="guide-actions">
        <button type="button" className="primary-button" onClick={onOpenDonate}>
          <HandCoins size={16} /> 打赏开发者
        </button>
        <button type="button" className="secondary-button" onClick={onOpenCustom}>
          功能定制与需求共建
        </button>
      </div>

      <p className="dev-footnote">
        <Heart size={13} /> 每一份支持，无论大小，都会变成这里更多更好的内容。
      </p>
    </div>
  )
}
