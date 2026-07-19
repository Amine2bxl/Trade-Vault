import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

// Shared AI-answer renderer — Insights page and the floating AI Assistant both
// use it so a Gemini response looks identical wherever it's shown.
export default function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div className="insights-md space-y-3 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-base md:text-lg font-bold text-white mt-4 first:mt-0 pb-1.5 border-b border-white/[0.06] flex items-center gap-2">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold text-white mt-3">{children}</h3>
          ),
          p: ({ children }) => <p className="text-slate-300">{children}</p>,
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="text-cyan-300 not-italic font-medium">{children}</em>
          ),
          ul: ({ children }) => <ul className="space-y-1.5 ml-1">{children}</ul>,
          ol: ({ children }) => (
            <ol className="space-y-1.5 ml-5 list-decimal marker:text-cyan-400 marker:font-bold">
              {children}
            </ol>
          ),
          li: ({ children, ...props }) => {
            const ordered = (props as any).ordered;
            if (ordered) return <li className="text-slate-300 pl-1">{children}</li>;
            return (
              <li className="flex gap-2 text-slate-300">
                <span className="text-cyan-400 mt-1.5 shrink-0 w-1 h-1 rounded-full bg-cyan-400" />
                <span className="flex-1">{children}</span>
              </li>
            );
          },
          table: ({ children }) => (
            <div className="overflow-x-auto rounded-lg border border-white/[0.08] my-2">
              <table className="w-full text-xs md:text-sm">{children}</table>
            </div>
          ),
          thead: ({ children }) => <thead className="bg-white/[0.04]">{children}</thead>,
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold text-white border-b border-white/[0.08]">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-300 border-b border-white/[0.04] last:border-0">
              {children}
            </td>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-cyan-300 text-[0.85em] font-mono">
              {children}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-cyan-500/60 pl-3 py-1 bg-cyan-500/5 rounded-r text-slate-200 italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="border-white/[0.06] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
