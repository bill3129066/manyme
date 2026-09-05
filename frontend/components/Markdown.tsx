import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'

export default function Markdown({ children }: { children: string }) {
  return <div className="markdown-content min-w-0 leading-relaxed">
    <ReactMarkdown remarkPlugins={[remarkGfm]} skipHtml components={{
      a: ({ children, href }) => <a href={href} target="_blank" rel="noopener noreferrer">{children}</a>,
      img: ({ alt }) => <span>{alt}</span>,
      table: ({ children }) => <div className="overflow-x-auto"><table>{children}</table></div>,
    }}>{children}</ReactMarkdown>
  </div>
}
