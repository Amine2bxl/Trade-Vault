import { memo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { numericText } from "@/shared/ui/NumericText";

// Shared AI-answer renderer — Insights page and the floating AI Assistant both
// use it so a Gemini response looks identical wherever it's shown.
const MarkdownAnswer = memo(function MarkdownAnswer({ content }: { content: string }) {
  return (
    <div className="insights-md space-y-3 leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h2: ({ children }) => (
            <h2 className="text-sm font-bold text-white mt-4 first:mt-0 pb-1.5 border-b border-white/[0.06]">
              {numericText(children)}
            </h2>
          ),
          h3: ({ children }) => <h3 className="tv-title mt-3">{numericText(children)}</h3>,
          p: ({ children }) => <p className="text-slate-300">{numericText(children)}</p>,
          strong: ({ children }) => (
            <strong className="text-white font-semibold">{numericText(children)}</strong>
          ),
          em: ({ children }) => (
            <em className="text-[var(--tv-highlight)] not-italic font-medium">
              {numericText(children)}
            </em>
          ),
          ul: ({ children }) => (
            <ul className="space-y-1.5 ml-4 list-disc marker:text-[var(--tv-highlight)]">
              {numericText(children)}
            </ul>
          ),
          ol: ({ children }) => (
            <ol className="space-y-1.5 ml-5 list-decimal marker:text-[var(--tv-accent)] marker:font-bold">
              {numericText(children)}
            </ol>
          ),
          li: ({ children }) => <li className="text-slate-300 pl-1">{numericText(children)}</li>,
          table: ({ children }) => (
            <div className="jarvis-data-table rounded-lg border border-white/[0.08] my-2">
              <table className="w-full table-fixed text-xs">{numericText(children)}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-white/[0.04]">{numericText(children)}</thead>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 font-semibold text-white border-b border-white/[0.08]">
              {numericText(children)}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-3 py-2 text-slate-300 border-b border-white/[0.04] last:border-0">
              {numericText(children)}
            </td>
          ),
          code: ({ children }) => (
            <code className="px-1.5 py-0.5 rounded bg-white/[0.06] text-[var(--tv-highlight)] text-[0.85em] font-mono">
              {numericText(children)}
            </code>
          ),
          blockquote: ({ children }) => (
            <blockquote className="border-l border-[rgb(var(--tv-accent-rgb)/0.5)] pl-3.5 py-1 text-slate-200 italic">
              {numericText(children)}
            </blockquote>
          ),
          hr: () => <hr className="border-white/[0.06] my-3" />,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
});

export default MarkdownAnswer;
