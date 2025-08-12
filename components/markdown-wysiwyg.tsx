"use client";

// Lightweight WYSIWYG Markdown editor using a contenteditable surface.
// Internally converts Markdown -> HTML for display (marked), and
// HTML -> Markdown on every change (turndown), so callers always receive Markdown.

import { useEffect, useMemo, useRef } from "react";
import { marked } from "marked";
import TurndownService from "turndown";

interface MarkdownWysiwygProps {
  value: string;
  onChange: (markdown: string) => void;
  height?: string;
}

export default function MarkdownWysiwyg({ value, onChange, height = "360px" }: MarkdownWysiwygProps) {
  const editorRef = useRef<HTMLDivElement | null>(null);

  const turndown = useMemo(() => {
    const td = new TurndownService({ headingStyle: "atx", bulletListMarker: "-" });
    return td;
  }, []);

  // Ensure editor reflects external value changes
  useEffect(() => {
    const el = editorRef.current;
    if (!el) return;
    const currentHtml = el.innerHTML.trim();
    const nextHtml = marked.parse(value || "").toString();
    if (currentHtml !== nextHtml) {
      el.innerHTML = nextHtml;
    }
  }, [value]);

  const emitMarkdown = () => {
    const el = editorRef.current;
    if (!el) return;
    const html = el.innerHTML;
    const md = turndown.turndown(html);
    onChange(md);
  };

  const exec = (command: string, valueArg?: string) => {
    // Deprecated but still broadly supported; sufficient for basic formatting
    document.execCommand(command, false, valueArg);
    emitMarkdown();
  };

  return (
    <div className="rounded-md border bg-background">
      <div className="flex flex-wrap gap-1 border-b p-2 text-xs">
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("bold")}>Bold</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("italic")}>Italic</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("underline")}>Underline</button>
        <span className="mx-2 text-muted-foreground">|</span>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("insertUnorderedList")}>• List</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("insertOrderedList")}>1. List</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("formatBlock", "blockquote")}>Quote</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("formatBlock", "h2")}>H2</button>
        <button className="px-2 py-1 rounded hover:bg-muted" onClick={() => exec("formatBlock", "h3")}>H3</button>
      </div>
      <div
        ref={editorRef}
        className="prose prose-invert max-w-none p-3 text-sm leading-relaxed min-h-[200px]"
        style={{ height, overflowY: "auto" }}
        contentEditable
        suppressContentEditableWarning
        onInput={emitMarkdown}
        onBlur={emitMarkdown}
      />
    </div>
  );
}


