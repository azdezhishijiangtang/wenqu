import { ClipboardCheck, Info, MessageCircle, QrCode, Rocket, Users, Wrench } from 'lucide-react'

interface Props {
  onOpenAbout: () => void
  onOpenDonate: () => void
}

const steps = [
  {
    icon: MessageCircle,
    title: '第一步 · 提出需求',
    desc: '你有想加的功能或想法，扫描下方二维码添加我的微信，把需求描述给我。',
  },
  {
    icon: ClipboardCheck,
    title: '第二步 · 评估可行性',
    desc: '我会认真评估需求的技术可行性、与网站的契合度以及开发工作量。',
  },
  {
    icon: Wrench,
    title: '第三步 · 定制开发',
    desc: '达成一致后，我按需求进行定制开发，过程中与你保持沟通确认效果。',
  },
  {
    icon: Rocket,
    title: '第四步 · 上架共建',
    desc: '功能开发完成后上架到本站，作为共建内容供所有用户使用，你的名字也会被记住。',
  },
]

export function CustomView({ onOpenAbout, onOpenDonate }: Props) {
  return (
    <div className="about-page">
      <header className="page-head">
        <p className="eyebrow">CO-BUILD &amp; CUSTOM</p>
        <h1>功能定制与需求共建</h1>
        <p className="page-sub">
          你希望这个网站有什么新功能？提出你的想法，我们一起把它变成现实——定制开发完成后会作为
          <strong>共建内容</strong>上架到本站，供所有用户免费使用。
        </p>
      </header>

      <section className="custom-steps" aria-label="共建流程">
        {steps.map(({ icon: Icon, title, desc }) => (
          <div className="custom-step" key={title}>
            <span className="interest-icon" aria-hidden="true">
              <Icon size={18} />
            </span>
            <div>
              <h3>{title}</h3>
              <p>{desc}</p>
            </div>
          </div>
        ))}
      </section>

      <section className="guide-section">
        <h2>
          <QrCode size={18} /> 添加开发者微信
        </h2>
        <div className="qr-with-copy">
          <figure className="qr-figure">
            <div className="qr-frame qr-frame-sm">
              <img
                src={`${import.meta.env.BASE_URL}images/wechat-qr.png`}
                alt="开发者微信二维码"
                width={820}
                height={1214}
                loading="eager"
              />
            </div>
            <figcaption>扫一扫上面的二维码，添加我为朋友。</figcaption>
          </figure>
          <div>
            <p>
              添加时请备注「<strong>功能定制</strong>」，并简单描述你想加的功能，例如：新的计算工具、可视化演示、
              学习小模块……只要是合理可行的想法，都可以聊。
            </p>
            <p>
              你的需求被采纳并开发完成后，将以「共建功能」的形式上线本站，
              <strong>供全体用户免费使用</strong>——你的一个点子，会让所有人都受益。
            </p>
          </div>
        </div>
      </section>

      <section className="fee-note">
        <Info size={18} aria-hidden="true" />
        <div>
          <strong>关于费用</strong>
          <p>
            功能定制属于<strong>个人技术服务</strong>，费用根据需求复杂度与开发工作量
            <strong>单独沟通</strong>，评估阶段不收取任何费用。简单的小想法也许很快就能实现，欢迎随时来聊。
          </p>
        </div>
      </section>

      <div className="guide-actions">
        <button type="button" className="secondary-button" onClick={onOpenAbout}>
          <Users size={15} /> 了解开发者
        </button>
        <button type="button" className="secondary-button" onClick={onOpenDonate}>
          打赏开发者
        </button>
      </div>
    </div>
  )
}
