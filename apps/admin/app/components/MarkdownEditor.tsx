"use client";

import { useRef, useState, useCallback, useId } from "react";
import { LinkIcon } from "@heroicons/react/16/solid";
import ReactMarkdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import rehypeSanitize from "rehype-sanitize";
import { sanitizeSchema } from "@/app/lib/sanitize";

type MarkdownEditorProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  rows?: number;
  label: string;
  ariaLabel?: string;
};

export default function MarkdownEditor({
  id,
  value,
  onChange,
  placeholder,
  rows = 4,
  label,
  ariaLabel,
}: MarkdownEditorProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [showPreview, setShowPreview] = useState(false);
  const generatedId = useId();
  const textareaId = id ?? generatedId;
  const accessibleLabel = (ariaLabel ?? label) || "Markdown editor";

  const wrapSelection = useCallback(
    (prefix: string, suffix: string, placeholder_text?: string) => {
      const ta = textareaRef.current;
      if (!ta) return;
      const start = ta.selectionStart;
      const end = ta.selectionEnd;
      const selected = value.substring(start, end);
      const text = selected || placeholder_text || "";

      // If already wrapped, unwrap
      const before = value.substring(0, start);
      const after = value.substring(end);
      if (before.endsWith(prefix) && after.startsWith(suffix) && selected) {
        const newValue =
          before.slice(0, -prefix.length) +
          selected +
          after.slice(suffix.length);
        onChange(newValue);
        requestAnimationFrame(() => {
          ta.selectionStart = start - prefix.length;
          ta.selectionEnd = end - prefix.length;
          ta.focus();
        });
        return;
      }

      const newValue = before + prefix + text + suffix + after;
      onChange(newValue);
      requestAnimationFrame(() => {
        if (selected) {
          ta.selectionStart = start + prefix.length;
          ta.selectionEnd = start + prefix.length + text.length;
        } else {
          ta.selectionStart = start + prefix.length;
          ta.selectionEnd = start + prefix.length + text.length;
        }
        ta.focus();
      });
    },
    [value, onChange],
  );

  const insertLink = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta) return;
    const start = ta.selectionStart;
    const end = ta.selectionEnd;
    const selected = value.substring(start, end);
    const before = value.substring(0, start);
    const after = value.substring(end);

    if (selected) {
      const newValue = before + "[" + selected + "](url)" + after;
      onChange(newValue);
      requestAnimationFrame(() => {
        // Select "url" for easy replacement
        ta.selectionStart = start + selected.length + 3;
        ta.selectionEnd = start + selected.length + 6;
        ta.focus();
      });
    } else {
      const newValue = before + "[link text](url)" + after;
      onChange(newValue);
      requestAnimationFrame(() => {
        ta.selectionStart = start + 1;
        ta.selectionEnd = start + 10;
        ta.focus();
      });
    }
  }, [value, onChange]);

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        {label ? (
          <label
            htmlFor={textareaId}
            className="block text-sm font-medium text-zinc-300"
          >
            {label}
          </label>
        ) : (
          <span />
        )}
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
        >
          {showPreview ? "Edit" : "Preview"}
        </button>
      </div>
      {showPreview ? (
        <div
          className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white min-h-[calc(1.5rem*var(--rows)+1.5rem)]"
          style={{ "--rows": rows } as React.CSSProperties}
        >
          {value ? (
            <div className="prose prose-sm prose-invert prose-p:text-zinc-300 prose-p:leading-relaxed prose-a:text-rose-400 prose-a:underline prose-strong:text-white prose-em:text-zinc-200 max-w-none">
              <ReactMarkdown
                rehypePlugins={[rehypeRaw, [rehypeSanitize, sanitizeSchema]]}
              >
                {value}
              </ReactMarkdown>
            </div>
          ) : (
            <p className="text-zinc-500">
              {placeholder || "Nothing to preview"}
            </p>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-0.5 bg-white/5 border border-white/10 border-b-0 rounded-t-lg px-2 py-1.5">
            <button
              type="button"
              onClick={() => wrapSelection("**", "**", "bold")}
              title="Bold"
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span className="font-bold text-xs">B</span>
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("*", "*", "italic")}
              title="Italic"
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span className="italic text-xs">I</span>
            </button>
            <button
              type="button"
              onClick={() => wrapSelection("<u>", "</u>", "underline")}
              title="Underline"
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <span className="underline text-xs">U</span>
            </button>
            <button
              type="button"
              onClick={insertLink}
              title="Link"
              className="w-7 h-7 flex items-center justify-center rounded-md text-zinc-400 hover:text-white hover:bg-white/10 transition-colors"
            >
              <LinkIcon className="size-4 shrink-0" aria-hidden="true" />
            </button>
          </div>
          <textarea
            id={textareaId}
            aria-label={accessibleLabel}
            ref={textareaRef}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            rows={rows}
            className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-b-lg text-white placeholder-zinc-500 focus:outline-none focus:border-rose-500/50 focus:ring-1 focus:ring-rose-500/50 resize-none font-mono text-sm"
          />
        </>
      )}
    </div>
  );
}
