// ── Agent 文本 Markdown 渲染（2026-10-15，K9 批准 react-markdown + remark-gfm；仅 Agent 侧） ──
// 默认不渲染原始 HTML（XSS 面为零）；链接统一新窗打开，由主进程 setWindowOpenHandler 转交系统浏览器。
// 排版规则见 index.css `.md-bubble`；流式分片对未闭合标记天然容错（下一片到达即重解析）。
// 独立成文件：对话气泡与门裁决卡共用同一渲染器，避免 ChatComposer ↔ GateCardView 循环依赖。
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function MarkdownText({ text }: { text: string }) {
  return (
    <div className="md-bubble">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noreferrer noopener" className="text-violet underline underline-offset-2">
              {children}
            </a>
          ),
          h1: ({ children }) => <h1 className="mt-2 text-[13.5px] font-extrabold first:mt-0">{children}</h1>,
          h2: ({ children }) => <h2 className="mt-2 text-[13px] font-bold first:mt-0">{children}</h2>,
          h3: ({ children }) => <h3 className="mt-1.5 text-[12.5px] font-bold first:mt-0">{children}</h3>,
          p: ({ children }) => <p className="my-1 first:mt-0 last:mb-0">{children}</p>,
          ul: ({ children }) => <ul className="my-1 ml-[18px] list-disc space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="my-1 ml-[18px] list-decimal space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="pl-0.5 marker:text-muted">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="my-1 border-l-2 border-line pl-2 text-muted">{children}</blockquote>
          ),
          hr: () => <hr className="my-2 border-line" />,
          table: ({ children }) => (
            <div className="my-1.5 overflow-x-auto">
              <table className="border-collapse text-[11px]">{children}</table>
            </div>
          ),
          th: ({ children }) => <th className="border border-line px-1.5 py-0.5 font-bold">{children}</th>,
          td: ({ children }) => <td className="border border-line px-1.5 py-0.5">{children}</td>,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}
