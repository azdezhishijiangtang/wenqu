import { BookMarked, CalendarDays, Cloud, Image, KeyRound, NotebookPen, ScanText, Sparkles, UserRound } from 'lucide-react'

interface Props {
  onOpenSettings: () => void
  onOpenAccount: () => void
  onOpenTutor: () => void
}

const steps = [
  { icon: KeyRound, title: '接上你自己的 AI', body: '点右上角钥匙图标，填 API 地址、模型名和 Key。请求由浏览器直接发给你选的模型服务商，本站不中转、不保存你的密钥。' },
  { icon: Sparkles, title: '开始问题', body: '选科目和模式，把题目贴进来。可以只问一个点，也可以让 AI 完整讲一遍。' },
  { icon: Image, title: '题目是图片也行', body: '粘贴或上传截图（最多 3 张），网站先帮你把图变成文字，核对后再交给你自己的模型推理。' },
]

export function GuideView({ onOpenSettings, onOpenAccount, onOpenTutor }: Props) {
  return (
    <div className="guide-page">
      <header className="page-head">
        <div>
          <p className="eyebrow">使用说明</p>
          <h1>问渠怎么用</h1>
          <p className="page-sub">三分钟上手，把四科答疑、错题本、学习计划和无障碍识图串起来。</p>
        </div>
      </header>

      <section className="guide-section">
        <h2>三步开始</h2>
        <ol className="guide-steps">
          {steps.map((step, index) => {
            const Icon = step.icon
            return (
              <li key={step.title}>
                <span className="step-index">{index + 1}</span>
                <div>
                  <h3><Icon size={16} /> {step.title}</h3>
                  <p>{step.body}</p>
                </div>
              </li>
            )
          })}
        </ol>
        <div className="guide-actions">
          <button className="primary-button" onClick={onOpenSettings}>打开 API 设置</button>
          <button className="secondary-button" onClick={onOpenTutor}>去答疑</button>
        </div>
      </section>

      <section className="guide-section">
        <h2><KeyRound size={18} /> 接入模型</h2>
        <p>
          「API 地址」填兼容 OpenAI Chat Completions 的地址，例如 <code>https://api.deepseek.com/v1</code>，
          也可以直接填完整的 <code>.../chat/completions</code>。「模型名称」按服务商文档填，例如 <code>deepseek-chat</code>。
        </p>
        <p>
          如果服务商不允许浏览器直接访问（跨域被拒），会提示网络错误，这时需要换成允许跨域的接口或自建代理。
          API Key 保存在当前浏览器，<strong>清除浏览器数据会一并清掉</strong>，换设备时可以用下面的导出/导入搬运，或重新填一次。
        </p>
      </section>

      <section className="guide-section">
        <h2><Sparkles size={18} /> 四种科目与三种模式</h2>
        <div className="guide-grid">
          <div>
            <h3>科目</h3>
            <p>数学、物理、化学、生物。选「综合」时会按题目关键词自动判断学科，提示词也会随之切换。</p>
          </div>
          <div>
            <h3>模式</h3>
            <p>
              <strong>启发式</strong>：先给思路，逐步解锁提示，适合自己还想过一遍的时候。<br />
              <strong>完整讲解</strong>：一步步写全，适合看标准解法。<br />
              <strong>应试速解</strong>：压缩到考场能写出来的长度。
            </p>
          </div>
        </div>
        <p className="guide-note">
          模型如果有推理过程，会折叠在「推理过程」面板里，不混进正式答案。点开可以看，也可以不看。
        </p>
      </section>

      <section className="guide-section">
        <h2><Image size={18} /> 图片题怎么看</h2>
        <p>上传或粘贴截图后，识图面板提供两条路。它们的成本和能力不同，按需选：</p>
        <div className="guide-compare">
          <div className="compare-col">
            <h3><ScanText size={16} /> 本地 OCR</h3>
            <ul>
              <li>在你的浏览器里跑开源识别引擎，<strong>不联网识图、不消耗次数</strong></li>
              <li>适合清晰印刷的题干、数字、选项</li>
              <li>不认识图形关系：函数曲线走势、电路连接、流程箭头都要你自己补</li>
              <li>首次使用要下载几 MB 的引擎和字库，手机上会慢一些</li>
            </ul>
          </div>
          <div className="compare-col">
            <h3><Cloud size={16} /> 云端图形理解</h3>
            <ul>
              <li>由本站的识图服务调用视觉模型，能描述坐标轴、曲线趋势、箭头和连接</li>
              <li><strong>必须登录识图账号</strong>，每个账号每天 3 张</li>
              <li>会慢一些，通常 7–20 秒</li>
              <li>模型也会看错，尤其是手写和复杂装置图</li>
            </ul>
          </div>
        </div>
        <p className="guide-note">
          两条路最后都要经过「核对」这一步：识别结果会填进文本框，你改掉错字、补充图形关系、
          勾选确认后，才会发给你的文字模型。主模型始终收不到原图。
        </p>
      </section>

      <section className="guide-section">
        <h2><UserRound size={18} /> 账号与换设备</h2>
        <p>
          识图账号用于记录每天用过几次云端识图：注册后用用户名和密码登录，
          <strong>同一账号在不同设备共享这 3 次额度</strong>，换浏览器、清缓存都不会重置。
          账号只保存密码哈希和当天的次数，不保存你的聊天、错题或图片。
        </p>
        <p>
          聊天记录、错题本、学习计划存在当前浏览器里。换设备时：
          <strong>旧设备导出 JSON → 传到新设备 → 新设备导入</strong>。
          导入会先整份校验再写入，可以选择「替换」或「合并」。
        </p>
        <div className="guide-actions">
          <button className="primary-button" onClick={onOpenAccount}>账号与数据</button>
        </div>
      </section>

      <section className="guide-section">
        <h2><NotebookPen size={18} /> 错题本</h2>
        <p>
          在答疑里想留住一道题，就记进错题本：写清题目、错因和正确思路，标记是否已掌握。
          复习时可以一键带着错因再问 AI，问题会包含你当时的错误想法，讲解更有针对性。
        </p>
      </section>

      <section className="guide-section">
        <h2><CalendarDays size={18} /> 学习计划</h2>
        <p>
          按周安排任务，填科目和预计分钟数，勾选完成。侧栏会统计今日待办与累计完成，
          页面里还有一个 25 分钟专注计时器。计划不会自动同步，导出备份时会一起带走。
        </p>
      </section>

      <section className="guide-section">
        <h2><BookMarked size={18} /> 知识手册</h2>
        <p>
          四科常用公式与规律的速查卡片，支持按科目和关键词筛选、复制 LaTeX，
          也可以直接让 AI 结合某条公式举例讲解。
        </p>
      </section>

      <section className="guide-section muted-card">
        <h2>需要知道的限制</h2>
        <ul className="guide-limits">
          <li>识图结果一定有出错的可能，尤其是手写、上下标、复杂公式和图形空间关系；请把它当作「帮你打字的助手」，不是标准答案。</li>
          <li>云端识图受免费额度限制，额度用完当天暂停，第二天恢复；不会自动转成付费服务。</li>
          <li>识图服务用的是 <code>workers.dev</code> 域名，个别网络（尤其是部分国内网络）会连不上或被解析到错误地址。遇到「连不上识图服务」，先用本地 OCR，或者换 Wi-Fi / 移动网络再试。</li>
          <li>聊天记录存在浏览器里，清理浏览器数据或换设备不会自动保留，请定期导出备份。</li>
          <li>AI 的解答也可能有错，尤其是计算步骤和边界条件。重要结论请自己验算。</li>
        </ul>
      </section>
    </div>
  )
}
