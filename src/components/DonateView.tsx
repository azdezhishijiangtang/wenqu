import { Coffee, HandCoins, Heart, ShieldCheck } from 'lucide-react'

interface Props {
  onOpenAbout: () => void
  onOpenCustom: () => void
}

const notes = [
  {
    icon: Coffee,
    title: '完全自愿',
    desc: '打赏与否、金额多少完全由你决定，请根据自身情况量力而行。',
  },
  {
    icon: ShieldCheck,
    title: '白嫖也没关系',
    desc: '如果你喜欢白嫖，开发者也完全不介意——免费使用本站的一切内容就好。',
  },
  {
    icon: Heart,
    title: '关注也是一种支持',
    desc: (
      <>
        网站更新、新项目和学科讲解都会发在 B 站，
        <a href="https://b23.tv/E9ZSgYS" target="_blank" rel="noopener noreferrer">
          「阿z的知识讲堂」
        </a>
        点个关注，免费的关注同样是最大的鼓励。
      </>
    ),
  },
]

export function DonateView({ onOpenAbout, onOpenCustom }: Props) {
  return (
    <div className="about-page">
      <header className="page-head">
        <p className="eyebrow">SUPPORT THE CREATOR</p>
        <h1>打赏开发者</h1>
        <p className="page-sub">
          创作不易。如果问渠对你真的有帮助，可以根据自身情况打赏感谢——每一笔心意都会变成更用心更新的动力。
        </p>
      </header>

      <section className="guide-section">
        <h2>
          <HandCoins size={18} /> 扫码打赏
        </h2>
        <figure className="qr-figure">
          <div className="qr-frame">
            <img
              src={`${import.meta.env.BASE_URL}images/donate-code.png`}
              alt="开发者赞赏码，微信扫码打赏"
              width={1037}
              height={1037}
              loading="eager"
            />
          </div>
          <figcaption>「创作不易，如果感到对你有帮助，可以根据自身情况打赏感谢哦」</figcaption>
        </figure>
        <p className="guide-note">
          用微信扫一扫即可。打赏不会解锁任何额外功能——本站所有功能对所有人始终免费、完全一致。
        </p>
      </section>

      <section className="donate-note-grid" aria-label="打赏说明">
        {notes.map(({ icon: Icon, title, desc }) => (
          <div className="interest-card" key={title}>
            <span className="interest-icon" aria-hidden="true">
              <Icon size={17} />
            </span>
            <h3>{title}</h3>
            <p>{desc}</p>
          </div>
        ))}
      </section>

      <div className="guide-actions">
        <button type="button" className="secondary-button" onClick={onOpenAbout}>
          了解开发者
        </button>
        <button type="button" className="secondary-button" onClick={onOpenCustom}>
          功能定制与需求共建
        </button>
      </div>
    </div>
  )
}
