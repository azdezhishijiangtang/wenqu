import { useEffect, useRef, useState } from 'react'
import type { Components } from 'react-markdown'
import ReactMarkdown from 'react-markdown'
import rehypeKatex from 'rehype-katex'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import 'katex/dist/katex.min.css'

const components: Components = {
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  ),
  pre: ({ children }) => <pre className="code-block">{children}</pre>,
}

export function MarkdownContent({ children }: { children: string }) {
  return (
    <div className="markdown">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={components}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}

export function MathText({ children }: { children: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{ p: ({ children }) => <>{children}</> }}
    >
      {children}
    </ReactMarkdown>
  )
}

export function useAutoScroll<T extends HTMLElement>(deps: unknown[]) {
  const ref = useRef<T>(null)
  const [shouldStick, setShouldStick] = useState(true)

  useEffect(() => {
    const element = ref.current
    if (!element) return
    const onScroll = () => {
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight
      setShouldStick(distance < 120)
    }
    element.addEventListener('scroll', onScroll)
    return () => element.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (shouldStick) {
      ref.current?.scrollTo({ top: ref.current.scrollHeight, behavior: 'smooth' })
    }
    // Scroll only when a conversation update is rendered.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  return ref
}
