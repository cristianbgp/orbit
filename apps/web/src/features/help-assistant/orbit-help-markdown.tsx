import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

const markdownElements = [
  "p",
  "h2",
  "h3",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "del",
  "blockquote",
  "code",
  "pre",
  "hr",
  "br",
  "a",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
  "input",
];

export default function OrbitHelpMarkdown({ children }: { children: string }) {
  return (
    <Markdown
      skipHtml
      remarkPlugins={[remarkGfm]}
      allowedElements={markdownElements}
      unwrapDisallowed
      components={{
        h2: ({ children }) => (
          <h2 className="font-display mt-6 text-xl font-semibold tracking-[-0.025em] first:mt-0">
            {children}
          </h2>
        ),
        h3: ({ children }) => (
          <h3 className="font-display mt-5 text-lg font-semibold first:mt-0">
            {children}
          </h3>
        ),
        p: ({ children }) => (
          <p className="mt-3 leading-7 first:mt-0">{children}</p>
        ),
        ul: ({ className, children }) => (
          <ul
            className={cn(
              "marker:text-primary mt-3 list-disc space-y-1.5 pl-5 [&.contains-task-list]:list-none [&.contains-task-list]:pl-0",
              className,
            )}
          >
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="marker:text-primary mt-3 list-decimal space-y-1.5 pl-5 marker:font-semibold">
            {children}
          </ol>
        ),
        li: ({ className, children }) => (
          <li className={cn("leading-7", className)}>{children}</li>
        ),
        del: ({ children }) => (
          <del className="text-muted-foreground decoration-border">
            {children}
          </del>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-border text-muted-foreground mt-4 border-l-2 pl-4 italic">
            {children}
          </blockquote>
        ),
        code: ({ children }) => (
          <code className="bg-muted rounded px-1.5 py-0.5 font-mono text-[0.9em] break-words">
            {children}
          </code>
        ),
        pre: ({ children }) => (
          <pre className="bg-muted mt-4 max-w-full overflow-x-auto rounded-lg p-4 text-sm leading-6 [&_code]:bg-transparent [&_code]:p-0">
            {children}
          </pre>
        ),
        table: ({ children }) => (
          <div className="border-border my-4 max-w-full overflow-x-auto rounded-lg border">
            <table className="w-full min-w-max border-collapse text-left text-sm">
              {children}
            </table>
          </div>
        ),
        th: ({ children }) => (
          <th className="border-border bg-muted/60 border-b px-3 py-2 font-semibold whitespace-nowrap">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border-border border-b px-3 py-2 align-top last:border-b-0">
            {children}
          </td>
        ),
        input: ({ node: _node, className, ...props }) => (
          <input
            {...props}
            disabled
            className={cn("border-input accent-primary mr-2 size-4", className)}
          />
        ),
        hr: () => <hr className="border-border my-5" />,
        a: ({ children }) => <span>{children}</span>,
      }}
    >
      {children}
    </Markdown>
  );
}
