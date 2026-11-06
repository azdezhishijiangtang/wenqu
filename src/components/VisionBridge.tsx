import { useEffect, useRef, useState } from 'react'
import type { Worker } from 'tesseract.js'
import { Modal } from './Modal'

interface Props { images: string[]; question: string; onClose: () => void; onConfirm: (text: string) => void }
const templates: Record<string, string> = {
  graph: '图片编号：\n横轴名称、单位、刻度：\n纵轴名称、单位、刻度：\n图例、标注点的坐标：\n各区间变化趋势、交点：\n看不清或未标明的部分：',
  geometry: '图片编号：\n点、线、面及连接关系：\n题目明确给定的长度、角度：\n平行、垂直、相切等明确标记：\n看不清或未标明的部分：',
  circuit: '图片编号：\n元件、物体和标号：\n各元件两端连接的节点（串联/并联）：\n电表位置、开关状态或力的方向：\n已标注的数值、单位：\n看不清或未标明的部分：',
  process: '图片编号：\n节点与物质/结构名称：\n有向关系（A → B，箭头上的条件）：\n各步骤输入、输出及实验条件：\n图例、分组、变量：\n看不清或未标明的部分：',
}

/**
 * 图片识别弹窗：只在浏览器本机跑 Tesseract.js OCR。
 * 本站没有后端，不上传原图、不需要账号、不消耗任何云端额度。
 */
export function VisionBridge({ images, question, onClose, onConfirm }: Props) {
  const [text, setText] = useState('')
  const [details, setDetails] = useState('')
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [checked, setChecked] = useState(false)
  const [kind, setKind] = useState('')

  const worker = useRef<Worker | null>(null)
  const run = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const stopWorker = () => {
    run.current += 1
    clearTimeout(timer.current)
    const current = worker.current
    worker.current = null
    if (current) void current.terminate().catch(() => {})
  }
  useEffect(() => () => { stopWorker() }, [])

  async function recognizeOcr() {
    stopWorker()
    const id = run.current
    setBusy(true); setError(''); setChecked(false)
    setStatus('正在加载本地识别引擎和中英文字库，首次使用较慢…')
    let current: Worker | null = null
    timer.current = setTimeout(() => {
      if (id !== run.current) return
      stopWorker(); setBusy(false)
      setError('识别超过 3 分钟，已停止。请检查网络、换用清晰的局部截图后重试，或直接手工填写。')
    }, 180000)
    try {
      const { createWorker, OEM } = await import('tesseract.js')
      if (id !== run.current) return
      const base = new URL(`${import.meta.env.BASE_URL}ocr/`, window.location.origin).href
      current = await createWorker(['chi_sim', 'eng'], OEM.LSTM_ONLY, {
        workerPath: `${base}worker.min.js`, corePath: base, langPath: base,
        logger: event => {
          if (id === run.current && event.status === 'recognizing text') {
            setStatus(`正在本机识别文字：${Math.round(event.progress * 100)}%`)
          }
        },
      })
      if (id !== run.current) return
      worker.current = current
      const results: string[] = []
      for (let i = 0; i < images.length; i++) {
        setStatus(`正在识别第 ${i + 1} / ${images.length} 张图片…`)
        const { data } = await current.recognize(images[i])
        if (id !== run.current) return
        results.push(`【图片 ${i + 1} · OCR 初稿，须核对】\n${data.text.trim() || '未识别到文字，请对照原图补充。'}`)
      }
      setText(results.join('\n\n'))
      setStatus('文字提取完成。请逐图核对，尤其是负号、指数、下标、单位和选项。')
    } catch {
      if (id === run.current) setError('本地识别未完成：可能是资源下载失败、浏览器不支持或内存不足。请重试、减少图片，或手工填写。')
    } finally {
      if (current) void current.terminate().catch(() => {})
      if (id === run.current) {
        clearTimeout(timer.current); worker.current = null; setBusy(false)
      }
    }
  }

  const confirm = () => onConfirm([
    '来源：浏览器本地 OCR 与用户人工核对、补充。主模型没有收到原图。OCR 不具备可靠的公式、几何或图形关系理解能力。',
    text.trim(),
    details.trim() ? `【用户补充的图形关系】\n${details.trim()}` : '没有提供额外图形关系；如题目依赖曲线、箭头或连接关系，不得自行补全。',
    '空白模板字段均表示信息未提供，不是题目条件。只依据已确认文字推理；遇到矛盾、疑似识别错误或必要信息不足时，明确询问缺少的内容。不得从示意图比例推断未给定的数值。',
  ].join('\n\n'))

  return <Modal open title="图片识别 → 核对 → 文字模型解题" description="识别全部在本机完成，不登录、不上传原图。核对后的文字交给你自己的解题模型。" onClose={onClose} footer={<button className="primary-button" disabled={busy || !checked || (!text.trim() && !details.trim())} onClick={confirm}>已核对，交给主模型解题</button>}>
    <div className="ocr-originals">{images.map((src, i) => <details key={i} open={images.length === 1}><summary>查看图片 {i + 1}（可横向滚动核对细节）</summary><div className="ocr-image-scroll"><img src={src} alt={`原图 ${i + 1}`} /></div></details>)}</div>
    {question && <p className="ocr-question">你的问题：{question}</p>}
    <p>OCR 在浏览器本机运行，不联网识图、不消耗次数。首次需下载开源引擎和字库。</p>
    <p>适合清晰印刷题干；公式、手写字可能出错，不会自动理解电路连接、流程箭头或几何关系。</p>
    <button className="secondary-button" disabled={busy || !!text.trim()} onClick={recognizeOcr}>{busy ? '正在识别…' : text.trim() ? '已有文字，清空后可重新识别' : '免费识别图片文字'}</button>
    {busy && <button className="text-button" onClick={() => { stopWorker(); setBusy(false); setStatus('已停止，可重试或手工填写。') }}>停止识别</button>}
    <p role="status" aria-live="polite">{status}</p>
    {error && <p role="alert" className="image-error">{error}</p>}
    <label className="field"><span>题干与标注（可手工填写；逐字核对公式和数字）</span><textarea rows={12} disabled={busy} value={text} onChange={e => { setText(e.target.value); setChecked(false) }} placeholder="识别结果会出现在这里。可以把分数写为 (a+b)/c、指数写为 x^2、下标写为 a_n。无法辨认的位置请标为 [不清楚]。" /></label>
    <label className="field"><span>选择图形补充模板（可选）</span><select value={kind} disabled={!!details.trim()} onChange={e => { setKind(e.target.value); setDetails(templates[e.target.value] || ''); setChecked(false) }}><option value="">无模板 / 自由补充</option><option value="graph">函数图、统计图</option><option value="geometry">几何图</option><option value="circuit">电路、受力、装置图</option><option value="process">化学流程、生物结构与实验</option></select></label>
    <label className="field"><span>图形关系与不确定之处（有图形时请补充；清空可重选模板）</span><textarea rows={7} value={details} onChange={e => { setDetails(e.target.value); setChecked(false); if (!e.target.value) setKind('') }} placeholder="例如：图片 1，A → B 的条件为加热；R1 与 R2 并联；横轴为时间 t/s。只填原图中可确认的信息。" /></label>
    <label className="ocr-confirm"><input type="checkbox" checked={checked} disabled={busy} onChange={e => setChecked(e.target.checked)} /><span>我已对照原图核对文字、公式和必要的图形关系；无法辨认的部分已注明。</span></label>
  </Modal>
}
