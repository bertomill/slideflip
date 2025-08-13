// Minimal type declarations to satisfy TypeScript for Markdown libs
// These are safe shims; the libraries ship their own types at runtime.

declare module "react-markdown" {
  import * as React from "react";
  import { PluggableList } from "unified";

  export interface ReactMarkdownProps {
    children?: React.ReactNode;
    remarkPlugins?: PluggableList;
    components?: Record<string, React.ComponentType<any>>; // eslint-disable-line @typescript-eslint/no-explicit-any
    className?: string;
  }

  const ReactMarkdown: React.FC<ReactMarkdownProps>;
  export default ReactMarkdown;
}

declare module "remark-gfm" {
  const remarkGfm: unknown;
  export default remarkGfm;
}

declare module "@toast-ui/react-editor" {
  import * as React from "react";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  export const Editor: React.ComponentType<any>;
}


