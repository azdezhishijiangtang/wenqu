/**
 * 增量解析思考标签。
 *
 * 很多模型或网关（DeepSeek R1 蒸馏版、QwQ、GLM-Air 等）通过
 * OpenAI 兼容接口返回时，会把思考过程以 <think>...</think> 内联在
 * content 里。这里把它从正文中剥离出来，交给「思考面板」展示。
 * 标签可能被流式 chunk 切断，所以带跨块缓冲。
 */

const OPEN = '<think>'
const CLOSE = '</think>'

export interface SplitResult {
  reasoning: string
  content: string
}

/** text 尾部与 tag 前缀重叠的长度（可能是被切断的标签） */
function partialSuffix(text: string, tag: string): number {
  const max = Math.min(tag.length - 1, text.length)
  for (let len = max; len > 0; len--) {
    if (tag.startsWith(text.slice(text.length - len))) return len
  }
  return 0
}

export class ThinkSplitter {
  private inThink = false
  private buffer = ''

  feed(chunk: string): SplitResult {
    this.buffer += chunk
    let reasoning = ''
    let content = ''

    while (this.buffer) {
      if (this.inThink) {
        const idx = this.buffer.indexOf(CLOSE)
        if (idx === -1) {
          const keep = partialSuffix(this.buffer, CLOSE)
          reasoning += this.buffer.slice(0, this.buffer.length - keep)
          this.buffer = this.buffer.slice(this.buffer.length - keep)
          break
        }
        reasoning += this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + CLOSE.length)
        this.inThink = false
      } else {
        const idx = this.buffer.indexOf(OPEN)
        if (idx === -1) {
          const keep = partialSuffix(this.buffer, OPEN)
          content += this.buffer.slice(0, this.buffer.length - keep)
          this.buffer = this.buffer.slice(this.buffer.length - keep)
          break
        }
        content += this.buffer.slice(0, idx)
        this.buffer = this.buffer.slice(idx + OPEN.length)
        this.inThink = true
      }
    }

    return { reasoning, content }
  }

  /** 流结束时调用：未闭合的 <think> 剩余内容视为思考文本 */
  flush(): SplitResult {
    const rest = this.buffer
    this.buffer = ''
    if (this.inThink) {
      this.inThink = false
      return { reasoning: rest, content: '' }
    }
    return { reasoning: '', content: rest }
  }
}
