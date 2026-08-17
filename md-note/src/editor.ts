import {
  EditorView,
  Decoration,
  ViewPlugin,
  keymap,
  drawSelection,
  dropCursor,
  type ViewUpdate,
  type DecorationSet,
} from "@codemirror/view";
import {
  EditorState,
  Compartment,
  type Extension,
  type Range,
} from "@codemirror/state";
import { HighlightStyle, syntaxHighlighting, syntaxTree } from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { tags as t } from "@lezer/highlight";
import type { SyntaxNodeRef } from "@lezer/common";
import { CodeBlockWidget, HrWidget } from "./editor/widgets/codeBlock";
import { BlockMathWidget, InlineMathWidget, scanMath } from "./editor/widgets/math";
import { TableWidget, parseTable } from "./editor/widgets/table";
import { ImageWidget, parseImage } from "./editor/widgets/image";
import { MermaidWidget } from "./editor/widgets/mermaid";
import { FrontMatterWidget } from "./editor/widgets/frontmatter";
import { tableTab, tableShiftTab } from "./editor/commands/table";
import { bracketExtensions } from "./editor/commands/brackets";
import { parseFrontMatter } from "./lib/frontmatter";
import { dirOf, relativePath, resolveAssetPath } from "./lib/paths";
import * as api from "./lib/tauri";

export type EditorMode = "preview" | "source";

const markdownHighlight = HighlightStyle.define([
  { tag: t.heading1, class: "cm-md-h1" },
  { tag: t.heading2, class: "cm-md-h2" },
  { tag: t.heading3, class: "cm-md-h3" },
  { tag: t.heading4, class: "cm-md-h4" },
  { tag: t.heading5, class: "cm-md-h5" },
  { tag: t.heading6, class: "cm-md-h6" },
  { tag: t.strong, fontWeight: "600" },
  { tag: t.emphasis, fontStyle: "italic" },
  { tag: t.strikethrough, textDecoration: "line-through" },
  { tag: t.link, class: "cm-md-link" },
  { tag: t.url, class: "cm-md-link" },
  { tag: t.monospace, class: "cm-md-code" },
  { tag: t.processingInstruction, color: "var(--fg-faint)" },
  { tag: t.comment, color: "var(--syntax-comment)" },
  { tag: t.keyword, color: "var(--syntax-keyword)" },
  { tag: t.string, color: "var(--syntax-string)" },
  { tag: t.number, color: "var(--syntax-number)" },
  { tag: t.typeName, color: "var(--syntax-type)" },
  { tag: t.meta, color: "var(--syntax-meta)" },
  { tag: t.operator, color: "var(--syntax-operator)" },
  { tag: t.bool, color: "var(--syntax-keyword)" },
]);

const HEADINGS = new Set([
  "ATXHeading1", "ATXHeading2", "ATXHeading3",
  "ATXHeading4", "ATXHeading5", "ATXHeading6",
]);

function hideMarkers(
  node: SyntaxNodeRef,
  name: string,
  decos: Range<Decoration>[],
  overlaps: (from: number, to: number) => boolean,
) {
  for (const c of node.node.getChildren(name)) {
    if (!overlaps(c.from, c.to)) {
      decos.push(Decoration.replace({}).range(c.from, c.to));
    }
  }
}

function fencedCodeInfo(node: SyntaxNodeRef, doc: EditorState["doc"]): string {
  const info = node.node.getChild("CodeInfo");
  if (!info) return "";
  return doc.sliceString(info.from, info.to);
}

function fencedCodeText(node: SyntaxNodeRef, doc: EditorState["doc"]): string {
  const text = node.node.getChild("CodeText");
  if (!text) return "";
  return doc.sliceString(text.from, text.to);
}

function isInCode(tree: ReturnType<typeof syntaxTree>, from: number, to: number): boolean {
  let inside = false;
  tree.iterate({
    from,
    to,
    enter(node) {
      if (node.name === "FencedCode" || node.name === "InlineCode") {
        inside = true;
        return false;
      }
    },
  });
  return inside;
}

function buildDecorations(view: EditorView, filePath: string | null): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const { state } = view;
  const sel = state.selection.main;
  const selFrom = sel.from;
  const selTo = sel.to;
  const doc = state.doc;
  const tree = syntaxTree(state);

  const overlaps = (from: number, to: number) => from <= selTo && selFrom <= to;

  const lineDeco = (from: number, to: number, cls: string) => {
    const s = doc.lineAt(from).number;
    const e = doc.lineAt(to).number;
    for (let i = s; i <= e; i++) {
      decos.push(Decoration.line({ class: cls }).range(doc.line(i).from));
    }
  };

  tree.iterate({
    enter(node) {
      const n = node.name;
      const from = node.from;
      const to = node.to;

      if (HEADINGS.has(n)) {
        for (const c of node.node.getChildren("HeaderMark")) {
          if (!overlaps(c.from, c.to)) {
            let end = c.to;
            if (end < to && doc.sliceString(end, end + 1) === " ") end++;
            decos.push(Decoration.replace({}).range(c.from, end));
          }
        }
        return;
      }

      if (n === "Blockquote") {
        hideMarkers(node, "QuoteMark", decos, overlaps);
        lineDeco(from, to, "md-blockquote");
        return;
      }

      if (n === "StrongEmphasis" || n === "Emphasis") {
        hideMarkers(node, "EmphasisMark", decos, overlaps);
        return;
      }

      if (n === "Strikethrough") {
        hideMarkers(node, "StrikethroughMark", decos, overlaps);
        return;
      }

      if (n === "InlineCode") {
        hideMarkers(node, "CodeMark", decos, overlaps);
        return;
      }

      if (n === "ListMark" || n === "TaskMarker") {
        if (!overlaps(from, to)) {
          decos.push(Decoration.replace({}).range(from, to));
        }
        return;
      }

      if (n === "Task") {
        lineDeco(from, to, "md-task-item");
        return;
      }

      if (n === "Link") {
        hideMarkers(node, "LinkMark", decos, overlaps);
        hideMarkers(node, "URL", decos, overlaps);
        if (!overlaps(from, to)) {
          decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        }
        return;
      }

      if (n === "Image") {
        if (!overlaps(from, to)) {
          const { alt, url } = parseImage(node, doc);
          const resolved = resolveAssetPath(filePath, url);
          decos.push(
            Decoration.replace({
              widget: new ImageWidget(url, alt, resolved),
              block: true,
            }).range(from, to),
          );
        }
        return;
      }

      if (n === "Autolink") {
        if (!overlaps(from, to)) {
          decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        }
        return;
      }

      if (n === "HorizontalRule") {
        if (!overlaps(from, to)) {
          decos.push(
            Decoration.replace({ widget: new HrWidget(), block: true }).range(from, to),
          );
        } else {
          lineDeco(from, to, "md-hr-editing");
        }
        return;
      }

      if (n === "Table") {
        if (!overlaps(from, to)) {
          const { header, rows } = parseTable(node, doc);
          decos.push(
            Decoration.replace({
              widget: new TableWidget(header, rows),
              block: true,
            }).range(from, to),
          );
        } else {
          lineDeco(from, to, "md-table-editing");
        }
        return;
      }

      if (n === "TableDelimiter") {
        if (!overlaps(from, to)) {
          decos.push(Decoration.replace({}).range(from, to));
        }
        return;
      }

      if (n === "FencedCode") {
        if (!overlaps(from, to)) {
          const lang = fencedCodeInfo(node, doc).trim().toLowerCase();
          const code = fencedCodeText(node, doc);
          if (lang === "mermaid") {
            decos.push(
              Decoration.replace({
                widget: new MermaidWidget(code),
                block: true,
              }).range(from, to),
            );
          } else {
            decos.push(
              Decoration.replace({
                widget: new CodeBlockWidget(code, lang),
                block: true,
              }).range(from, to),
            );
          }
        } else {
          lineDeco(from, to, "md-codeblock-editing");
        }
        return;
      }

      if (n === "BulletList" || n === "OrderedList") {
        lineDeco(from, to, "md-list");
      }
    },
  });

  // 数学公式（$...$ / $$...$$）
  const inCode = (from: number, to: number) => isInCode(tree, from, to);
  for (const math of scanMath(doc, inCode)) {
    if (!overlaps(math.from, math.to)) {
      decos.push(
        Decoration.replace({
          widget: math.block
            ? new BlockMathWidget(math.tex)
            : new InlineMathWidget(math.tex),
          block: math.block,
        }).range(math.from, math.to),
      );
    }
  }

  // YAML Front Matter
  const fm = parseFrontMatter(doc.toString());
  if (fm && !overlaps(fm.from, fm.to)) {
    const summary = Object.entries(fm.data)
      .slice(0, 3)
      .map(([k, v]) => `${k}: ${v}`)
      .join(" · ");
    decos.push(
      Decoration.replace({
        widget: new FrontMatterWidget(summary),
        block: true,
      }).range(fm.from, fm.to),
    );
  }

  // 脚注引用 [^label]
  const fnRe = /\[\^([^\]]+)\]/g;
  const text = doc.toString();
  let fnm: RegExpExecArray | null;
  while ((fnm = fnRe.exec(text))) {
    const from = fnm.index;
    const to = from + fnm[0].length;
    if (!inCode(from, to) && !overlaps(from, to) && !(fm && from < fm.to)) {
      decos.push(
        Decoration.mark({ class: "cm-md-footnote" }).range(from, to),
      );
    }
  }

  return Decoration.set(decos, true);
}

function livePreview(filePath: string | null) {
  return ViewPlugin.fromClass(
    class {
      decorations: DecorationSet;
      constructor(view: EditorView) {
        this.decorations = buildDecorations(view, filePath);
      }
      update(u: ViewUpdate) {
        if (u.docChanged || u.selectionSet || u.viewportChanged) {
          this.decorations = buildDecorations(u.view, filePath);
        }
      }
    },
    { decorations: (v) => v.decorations },
  );
}

const previewCompartment = new Compartment();
const typewriterCompartment = new Compartment();

function previewExt(mode: EditorMode, filePath: string | null): Extension {
  return mode === "preview" ? livePreview(filePath) : [];
}

function typewriterExt(enabled: boolean): Extension {
  if (!enabled) return [];
  return ViewPlugin.fromClass(
    class {
      update(u: ViewUpdate) {
        if (u.selectionSet || u.docChanged) {
          const head = u.state.selection.main.head;
          u.view.dispatch({
            effects: EditorView.scrollIntoView(head, { y: "center" }),
          });
        }
      }
    },
  );
}

async function insertImage(
  view: EditorView,
  filePath: string | null,
  bytes: Uint8Array,
  ext = "png",
) {
  const dir = filePath ? dirOf(filePath) : ".";
  const name = `image-${Date.now()}.${ext}`;
  const absPath = `${dir}/${name}`.replace(/\\/g, "/");
  await api.writeBinary(absPath, Array.from(bytes));
  const rel = filePath ? relativePath(dir, absPath) : name;
  const insert = `![](${rel})`;
  const pos = view.state.selection.main.head;
  view.dispatch({
    changes: { from: pos, insert: `\n${insert}\n` },
    selection: { anchor: pos + insert.length + 2 },
  });
}

function mediaHandlers(filePath: string | null): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return true;
          void file.arrayBuffer().then((buf) => {
            const ext = file.type.split("/")[1] || "png";
            void insertImage(view, filePath, new Uint8Array(buf), ext);
          });
          return true;
        }
      }
      return false;
    },
    drop(event, view) {
      const files = event.dataTransfer?.files;
      if (!files?.length) return false;
      const file = files[0];
      if (!file.type.startsWith("image/") && !/\.(png|jpe?g|gif|webp|svg)$/i.test(file.name)) {
        return false;
      }
      event.preventDefault();
      void file.arrayBuffer().then((buf) => {
        const ext = file.name.split(".").pop() || "png";
        void insertImage(view, filePath, new Uint8Array(buf), ext);
      });
      return true;
    },
    mousedown(event, view) {
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null) return false;
      const line = view.state.doc.lineAt(pos);
      const m = /^(\s*[-*+]\s+)\[([ xX])\](\s)/.exec(line.text);
      if (!m) return false;
      const bracketPos = line.from + m[1].length;
      if (pos < bracketPos || pos > bracketPos + 3) return false;
      const checked = m[2].toLowerCase() === "x";
      const newMark = checked ? " " : "x";
      view.dispatch({
        changes: { from: bracketPos + 1, to: bracketPos + 2, insert: newMark },
      });
      event.preventDefault();
      return true;
    },
  });
}

export interface EditorHandle {
  view: EditorView;
  setMode: (m: EditorMode) => void;
  setTypewriter: (on: boolean) => void;
  scrollToLine: (line: number) => void;
  destroy: () => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  opts: {
    mode: EditorMode;
    filePath: string | null;
    typewriter: boolean;
    onChange: (doc: string) => void;
    onModeChange: (m: EditorMode) => void;
  },
): EditorHandle {
  let mode = opts.mode;
  let typewriter = opts.typewriter;
  const filePath = opts.filePath;

  function toggleMode() {
    mode = mode === "preview" ? "source" : "preview";
    view.dispatch({
      effects: previewCompartment.reconfigure(previewExt(mode, filePath)),
    });
    opts.onModeChange(mode);
  }

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(markdownHighlight),
      keymap.of([
        ...defaultKeymap,
        ...historyKeymap,
        ...markdownKeymap,
        ...searchKeymap,
        indentWithTab,
        { key: "Tab", run: tableTab },
        { key: "Shift-Tab", run: tableShiftTab },
      ]),
      search({ top: true }),
      highlightSelectionMatches(),
      bracketExtensions(),
      keymap.of([{ key: "Mod-/", run: () => { toggleMode(); return true; } }]),
      previewCompartment.of(previewExt(mode, filePath)),
      typewriterCompartment.of(typewriterExt(typewriter)),
      mediaHandlers(filePath),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) opts.onChange(u.state.doc.toString());
      }),
    ],
  });

  const view = new EditorView({ state, parent });

  return {
    view,
    setMode: (m: EditorMode) => {
      if (m !== mode) toggleMode();
    },
    setTypewriter: (on: boolean) => {
      if (on === typewriter) return;
      typewriter = on;
      view.dispatch({
        effects: typewriterCompartment.reconfigure(typewriterExt(typewriter)),
      });
    },
    scrollToLine: (line: number) => {
      const n = Math.max(1, Math.min(line, view.state.doc.lines));
      const pos = view.state.doc.line(n).from;
      view.dispatch({
        effects: EditorView.scrollIntoView(pos, { y: "center" }),
        selection: { anchor: pos },
      });
      view.focus();
    },
    destroy: () => view.destroy(),
  };
}
