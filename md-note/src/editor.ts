import {
  EditorView,
  Decoration,
  keymap,
  drawSelection,
  dropCursor,
  lineNumbers,
  highlightActiveLine,
  type DecorationSet,
} from "@codemirror/view";
import {
  EditorState,
  Compartment,
  StateEffect,
  StateField,
  type Extension,
  type Range,
} from "@codemirror/state";
import {
  HighlightStyle,
  ensureSyntaxTree,
  syntaxHighlighting,
  syntaxTree,
} from "@codemirror/language";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { search, searchKeymap, highlightSelectionMatches } from "@codemirror/search";
import { markdown, markdownKeymap, markdownLanguage } from "@codemirror/lang-markdown";
import { tags as t } from "@lezer/highlight";
import type { SyntaxNode, SyntaxNodeRef } from "@lezer/common";
import { CodeBlockWidget, HrWidget } from "./editor/widgets/codeBlock";
import { BlockMathWidget, InlineMathWidget, scanMath } from "./editor/widgets/math";
import {
  TableWidget,
  insertTableAtCursor,
  parseTable,
  tableBackspace,
  tableDeleteKey,
  tableSelectionSnap,
  type TableRange,
} from "./editor/widgets/table";
import { ImageWidget, parseImage } from "./editor/widgets/image";
import { MermaidWidget } from "./editor/widgets/mermaid";
import { FrontMatterWidget } from "./editor/widgets/frontmatter";
import {
  EditableMetadataWidget,
  HtmlBlockWidget,
  InlinePreviewWidget,
} from "./editor/widgets/preview";
import { tableTab, tableShiftTab } from "./editor/commands/table";
import { enterAdjacentBlock, focusBlockStartingAt } from "./editor/widgets/editableSource";
import { bracketExtensions } from "./editor/commands/brackets";
import { editorActionKeymap, runEditorAction, type EditorAction } from "./editor/commands/format";
import { parseFrontMatter } from "./lib/frontmatter";
import { dirOf, resolveAssetPath } from "./lib/paths";
import { addPendingImage } from "./lib/pendingImages";
import { htmlToMarkdown } from "./lib/htmlPaste";
import { openUrl } from "@tauri-apps/plugin-opener";
import * as api from "./lib/tauri";
import {
  editorShowError,
  editorShowMessage,
} from "./lib/editorBridge";
import { getLocale, t as tr } from "./lib/i18n";
import { currentBlockRange } from "./editor/widgets/blockRange";

export type EditorMode = "preview" | "source";

/** 同一个 CodeMirror 文档版本只物化一次字符串，供预览构建和 onChange 复用。 */
const docTextCache = new WeakMap<object, string>();

function documentText(doc: EditorState["doc"]): string {
  const cached = docTextCache.get(doc);
  if (cached !== undefined) return cached;
  const text = doc.toString();
  docTextCache.set(doc, text);
  return text;
}

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
  "SetextHeading1", "SetextHeading2",
]);

/** 标题级别：用于给标题行加上与 Typora 一致的上方留白 */
function headingLevel(name: string): number {
  const m = /(\d)$/.exec(name);
  return m ? Number(m[1]) : 1;
}

/** 真正把标记从排版里拿掉（透明字符仍会占位，会在链接后留下大片空白） */
const HIDE_MARK = Decoration.replace({});

/**
 * 块级 Widget 都有自己的原位编辑器，CodeMirror 光标即使恢复到其源码范围内，
 * 也不能撤掉组件并露出整块 Markdown（表格会因此退回一排 `|` 源码）。
 */
function blockReveal(_from: number, _to: number) {
  return { revealFrom: 1, revealTo: 0 };
}

/**
 * 永不显形。
 *
 * 过滤条件是 `head < revealFrom || head > revealTo`，给一个空区间
 * （from > to）就永远成立。用于列表符号、引用标记这类
 * 「Typora 里根本看不到源码」的标记。
 */
const NEVER_REVEAL = { from: 1, to: 0 };

/** 任务项：行首标记（含有序列表形式） */
const TASK_LINE_RE = /^(\s*(?:[-*+]|\d+[.)])\s+)\[([ xX])\](\s|$)/;

/** 行内包裹语法：Lezer 不认或不给配对信息，但导出链路支持，预览必须跟上 */
function tagWrap(tag: string, cls: string) {
  return { re: new RegExp(`<${tag}(?:\\s+[^>\\n]*)?>([^\\n]*?)</${tag}>`, "gi"), cls };
}

const INLINE_WRAPS: Array<{ re: RegExp; cls: string }> = [
  { re: /==([^=\n]+?)==/g, cls: "md-highlight" },
  tagWrap("u", "md-underline"),
  tagWrap("sup", "md-sup"),
  tagWrap("sub", "md-sub"),
  tagWrap("mark", "md-highlight"),
  tagWrap("b", "md-strong"),
  tagWrap("strong", "md-strong"),
  tagWrap("i", "md-em"),
  tagWrap("em", "md-em"),
  tagWrap("s", "md-del"),
  tagWrap("del", "md-del"),
  tagWrap("kbd", "md-kbd"),
];

/** 单独出现、没有配对的行内标签（换行、水平线等） */
const INLINE_VOID_TAGS = /<br\s*\/?>/gi;

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

interface LinkDefinition {
  url: string;
  title: string;
}

function normalizeLinkLabel(label: string): string {
  return label.trim().replace(/\s+/g, " ").toLowerCase();
}

function linkTitleText(raw: string): string {
  if (raw.length >= 2 && /["'(]/.test(raw[0])) return raw.slice(1, -1);
  return raw;
}

function collectLinkDefinitions(
  tree: ReturnType<typeof syntaxTree>,
  doc: EditorState["doc"],
): Map<string, LinkDefinition> {
  const definitions = new Map<string, LinkDefinition>();
  tree.iterate({
    enter(node) {
      if (node.name !== "LinkReference") return;
      const label = node.node.getChild("LinkLabel");
      const url = node.node.getChild("URL");
      if (!label || !url) return false;
      const rawLabel = doc.sliceString(label.from + 1, label.to - 1);
      if (rawLabel.startsWith("^")) return false;
      const title = node.node.getChild("LinkTitle");
      definitions.set(normalizeLinkLabel(rawLabel), {
        url: doc.sliceString(url.from, url.to).replace(/^<|>$/g, ""),
        title: title ? linkTitleText(doc.sliceString(title.from, title.to)) : "",
      });
      return false;
    },
  });
  return definitions;
}

function decodeEntity(raw: string): string {
  const textarea = document.createElement("textarea");
  textarea.innerHTML = raw;
  return textarea.value;
}

interface PreviewSets {
  /** 行装饰：引用/列表/任务，不随光标隐藏 */
  lines: DecorationSet;
  /** 标记隐藏与块级 Widget，未按光标过滤 */
  statics: DecorationSet;
  /** statics 按当前选区过滤后的结果 */
  visible: DecorationSet;
  /** 自带编辑能力的块（表格/代码块/公式/图表/图片/分割线/front matter）：
   *  光标以整块为单位跳过，不会掉进源码里 */
  atomicBlocks: TableRange[];
}

/**
 * 构建与光标无关的装饰。
 *
 * 只在文档变化时调用；移动光标只做一次范围受限的过滤（见 applySelection），
 * 避免每次按方向键都重新遍历语法树并把全文物化成字符串。
 */
function buildPreviewSets(
  state: EditorState,
  filePath: string | null,
): { lines: DecorationSet; statics: DecorationSet; atomicBlocks: TableRange[] } {
  const lineDecos: Range<Decoration>[] = [];
  const decos: Range<Decoration>[] = [];
  const atomicBlocks: TableRange[] = [];
  const doc = state.doc;
  // 长文档初始化时 Lezer 可能只同步解析前半段。若直接拿这棵临时树构建
  // 装饰，靠后的表格、围栏代码和 Mermaid 就会永久停留为源码。
  const tree = ensureSyntaxTree(state, doc.length, 100) ?? syntaxTree(state);
  const text = documentText(doc);
  const linkDefinitions = collectLinkDefinitions(tree, doc);

  const fm = parseFrontMatter(text);
  const fmEnd = fm ? fm.to : 0;

  const hide = (from: number, to: number, reveal?: { from: number; to: number }) => {
    if (to <= from) return;
    decos.push(
      (reveal
        ? Decoration.replace({ revealFrom: reveal.from, revealTo: reveal.to })
        : HIDE_MARK
      ).range(from, to),
    );
  };

  // 标记的「露出触发范围」是整个节点：光标落在 **粗体** 中间也应看到源码，
  // 而不是只有正好压在 ** 上时才显形
  const hideChildren = (node: SyntaxNodeRef, name: string) => {
    const reveal = { from: node.from, to: node.to };
    for (const c of node.node.getChildren(name)) hide(c.from, c.to, reveal);
  };

  /** 块级替换装饰要求区间恰好占满整行，否则会把所在行从中间劈开 */
  const coversWholeLines = (from: number, to: number) =>
    doc.lineAt(from).from === from && doc.lineAt(to).to === to;

  const addLineClass = (
    lineFrom: number,
    cls: string,
    attributes?: Record<string, string>,
  ) => {
    lineDecos.push(Decoration.line({ class: cls, attributes }).range(lineFrom));
  };

  /** 整块的每一行都加类（引用竖线、列表缩进） */
  const lineDecoAll = (
    from: number,
    to: number,
    cls: string,
    attributes?: Record<string, string>,
  ) => {
    const s = doc.lineAt(from).number;
    const e = doc.lineAt(to).number;
    for (let i = s; i <= e; i++) addLineClass(doc.line(i).from, cls, attributes);
  };

  const listDepth = (node: SyntaxNodeRef): number => {
    let depth = 0;
    for (let p = node.node.parent; p; p = p.parent) {
      if (p.name === "BulletList" || p.name === "OrderedList") depth++;
    }
    return depth;
  };

  tree.iterate({
    enter(node) {
      const n = node.name;
      const from = node.from;
      const to = node.to;

      // front matter 区间由专门的 Widget 接管，跳过 Lezer 在这里的误判
      // （`---` 会被解析成 HorizontalRule + SetextHeading）
      // 注意用 to <= fmEnd 判断：根节点 from 也是 0，用 from 会直接中止整棵树的遍历
      if (fm && to <= fmEnd) return false;

      if (HEADINGS.has(n)) {
        // 标题上方留白：Typora 里标题与前文之间有明显间距
        addLineClass(doc.lineAt(from).from, `md-heading md-heading-${headingLevel(n)}`);
        for (const c of node.node.getChildren("HeaderMark")) {
          decos.push(
            Decoration.mark({ class: "cm-md-heading-mark", ...blockReveal(c.from, c.to) })
              .range(c.from, c.to),
          );
          // ATX：`## ` 在行首；Setext：`===` 单独占下一行，连同换行一起吃掉
          if (c.from > from) {
            hide(c.from - 1, c.to, { from, to });
          } else {
            let end = c.to;
            if (end < to && doc.sliceString(end, end + 1) === " ") end++;
            hide(c.from, end, { from, to });
          }
        }
        return;
      }

      if (n === "QuoteMark") {
        // 必须在遍历里单独处理：只有第一行的 `>` 是 Blockquote 的直接子节点，
        // 后续行的 QuoteMark 嵌在 Paragraph / List 里，getChildren 拿不到
        let end = to;
        if (doc.sliceString(end, end + 1) === " ") end++;
        hide(from, end, NEVER_REVEAL);
        return;
      }

      if (n === "Blockquote") {
        lineDecoAll(from, to, "md-blockquote");
        return;
      }

      if (n === "StrongEmphasis" || n === "Emphasis") {
        hideChildren(node, "EmphasisMark");
        return;
      }

      if (n === "Strikethrough") {
        hideChildren(node, "StrikethroughMark");
        return;
      }

      if (n === "InlineCode") {
        hideChildren(node, "CodeMark");
        return;
      }

      if (n === "Subscript" || n === "Superscript") {
        const markName = n === "Subscript" ? "SubscriptMark" : "SuperscriptMark";
        const marks = node.node.getChildren(markName);
        if (marks.length >= 2) {
          const reveal = { from, to };
          hide(marks[0].from, marks[0].to, reveal);
          decos.push(
            Decoration.mark({ class: n === "Subscript" ? "md-sub" : "md-sup" })
              .range(marks[0].to, marks[marks.length - 1].from),
          );
          hide(marks[marks.length - 1].from, marks[marks.length - 1].to, reveal);
        }
        return;
      }

      if (n === "Entity") {
        decos.push(
          Decoration.replace({
            widget: new InlinePreviewWidget(from, to, decodeEntity(doc.sliceString(from, to)), "md-entity"),
            revealFrom: from,
            revealTo: to,
          }).range(from, to),
        );
        return;
      }

      if (n === "HardBreak") {
        hide(from, Math.max(from, to - 1), { from, to });
        return;
      }

      if (n === "ListMark" || n === "TaskMarker") {
        // 与 Typora 一致：列表符号与复选框的源码永不显形，由 CSS 画出来
        let end = to;
        if (doc.sliceString(end, end + 1) === " ") end++;
        hide(from, end, NEVER_REVEAL);
        return;
      }

      if (n === "Task") {
        const m = TASK_LINE_RE.exec(doc.lineAt(from).text);
        const done = m ? m[2].toLowerCase() === "x" : false;
        // 只给首行：复选框是 ::before 画的，多行任务项会画出好几个
        addLineClass(doc.lineAt(from).from, done ? "md-task-item md-task-done" : "md-task-item");
        return;
      }

      if (n === "ListItem") {
        const depth = listDepth(node);
        const parent = node.node.parent;
        const indentExtra = depth > 1 ? (depth - 1) * 24 : 0;
        const indentStyle =
          indentExtra > 0
            ? `--md-list-marker-left: calc(var(--editor-padding-x) + ${indentExtra}px); padding-left: calc(var(--editor-padding-x) + var(--editor-list-marker-offset) + ${indentExtra}px);`
            : "";

        const firstLine = doc.lineAt(from);
        const lastLine = doc.lineAt(to);
        const ordered = parent?.name === "OrderedList";

        // 有序列表显示源码里真实的序号（`3.` 就该显示 3，而不是 CSS 计数器从 1 重排）
        let markerStyle = "";
        if (ordered) {
          const mark = node.node.getChild("ListMark");
          const raw = mark ? doc.sliceString(mark.from, mark.to) : "";
          const safe = raw.replace(/[^0-9.)]/g, "");
          if (safe) markerStyle = `--md-marker: "${safe}";`;
        }

        // 每行只挂一条带 style 的行装饰，避免多条装饰的 style 互相覆盖
        const firstClasses = ordered
          ? "md-list-item md-ordered-list"
          : parent?.name === "BulletList"
            ? "md-list-item md-bullet-list"
            : "md-list-item";
        addLineClass(
          firstLine.from,
          firstClasses,
          indentStyle || markerStyle ? { style: `${indentStyle}${markerStyle}` } : undefined,
        );
        for (let i = firstLine.number + 1; i <= lastLine.number; i++) {
          addLineClass(
            doc.line(i).from,
            "md-list-item",
            indentStyle ? { style: indentStyle } : undefined,
          );
        }
        return;
      }

      if (n === "Escape") {
        // `\*` 只显示 `*`，反斜杠藏掉
        hide(from, from + 1, { from, to });
        return;
      }

      if (n === "Link") {
        if (doc.sliceString(from, Math.min(to, from + 2)) === "[^") return false;
        hideChildren(node, "LinkMark");
        hideChildren(node, "URL");
        hideChildren(node, "LinkTitle");
        // 引用式链接 [文字][ref] 的 [ref] 也要藏
        hideChildren(node, "LinkLabel");
        decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        return;
      }

      if (n === "Image") {
        const { alt, url, title } = parseImage(node, doc, linkDefinitions);
        const resolved = resolveAssetPath(filePath, url);
        // 行内图片必须用行内装饰，否则会把整行从中间截断
        const block = coversWholeLines(from, to);
        if (block) atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget: new ImageWidget(from, to, url, alt, resolved, !block, title),
            block,
            ...(block ? blockReveal(from, to) : null),
          }).range(from, to),
        );
        return;
      }

      if (n === "Autolink") {
        // <https://x> 的尖括号要藏掉
        hideChildren(node, "LinkMark");
        decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        return;
      }

      if (n === "URL" && node.node.parent?.name === "Paragraph") {
        decos.push(Decoration.mark({ class: "cm-md-link" }).range(from, to));
        return;
      }

      if (n === "LinkReference") {
        const labelNode = node.node.getChild("LinkLabel");
        const rawLabel = labelNode ? doc.sliceString(labelNode.from + 1, labelNode.to - 1) : "";
        if (rawLabel.startsWith("^")) return false;
        if (!coversWholeLines(from, to)) return false;
        const definition = linkDefinitions.get(normalizeLinkLabel(rawLabel));
        atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget: new EditableMetadataWidget(
              from,
              to,
              doc.sliceString(from, to),
              tr(getLocale(), "editor.linkDefinition", {
                label: rawLabel,
                url: definition?.url ?? "",
              }),
              "reference",
            ),
            block: true,
            ...blockReveal(from, to),
          }).range(from, to),
        );
        return false;
      }

      if (n === "HTMLBlock") {
        if (!coversWholeLines(from, to)) return false;
        atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget: new HtmlBlockWidget(from, to, doc.sliceString(from, to)),
            block: true,
            ...blockReveal(from, to),
          }).range(from, to),
        );
        return false;
      }

      if (n === "CodeBlock") {
        const blockFrom = doc.lineAt(from).from;
        const blockTo = doc.lineAt(to).to;
        if (!coversWholeLines(blockFrom, blockTo)) return false;
        const code = node.node.getChildren("CodeText")
          .map((child) => doc.sliceString(child.from, child.to))
          .join("");
        atomicBlocks.push({ from: blockFrom, to: blockTo });
        decos.push(
          Decoration.replace({
            widget: new CodeBlockWidget(blockFrom, blockTo, code, "", true),
            block: true,
            ...blockReveal(blockFrom, blockTo),
          }).range(blockFrom, blockTo),
        );
        return false;
      }

      if (n === "HorizontalRule") {
        if (!coversWholeLines(from, to)) return;
        atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget: new HrWidget(from, to),
            block: true,
            ...blockReveal(from, to),
          }).range(from, to),
        );
        return;
      }

      if (n === "Table") {
        if (!coversWholeLines(from, to)) return;
        const { header, rows, aligns } = parseTable(node, doc);
        atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget: new TableWidget(from, to, header, rows, aligns),
            block: true,
            ...blockReveal(from, to),
          }).range(from, to),
        );
        return;
      }

      if (n === "FencedCode") {
        // 未闭合的围栏按 CommonMark 会一直吃到文末，渲染成组件会把整篇文档吞掉
        if (node.node.getChildren("CodeMark").length < 2) return;
        const lang = fencedCodeInfo(node, doc).trim().toLowerCase();
        const code = fencedCodeText(node, doc);
        const block = coversWholeLines(from, to);
        if (!block) {
          // 缩进在列表里的围栏代码块：只隐藏围栏，不做块级替换
          hideChildren(node, "CodeMark");
          return;
        }
        atomicBlocks.push({ from, to });
        decos.push(
          Decoration.replace({
            widget:
              lang === "mermaid"
                ? new MermaidWidget(from, to, code)
                : new CodeBlockWidget(from, to, code, lang),
            block: true,
            ...blockReveal(from, to),
          }).range(from, to),
        );
        return;
      }
    },
  });

  // 数学公式（$...$ / $$...$$）
  const inCode = (from: number, to: number) => isInCode(tree, from, to);
  for (const math of scanMath(doc, inCode, text)) {
    if (fm && math.from < fmEnd) continue;
    if (math.block) atomicBlocks.push({ from: math.from, to: math.to });
    decos.push(
      Decoration.replace({
        widget: math.block
          ? new BlockMathWidget(math.from, math.to, math.tex)
          : new InlineMathWidget(math.from, math.to, math.tex),
        block: math.block,
        ...(math.block ? blockReveal(math.from, math.to) : null),
      }).range(math.from, math.to),
    );
  }

  // ==高亮==、<u>/<mark>/<b>/<i>/<kbd> 等行内标签
  for (const wrap of INLINE_WRAPS) {
    wrap.re.lastIndex = 0;
    let m: RegExpExecArray | null;
    while ((m = wrap.re.exec(text))) {
      const inner = m[1];
      if (!inner) continue; // 空内容，mark 不能为空区间
      const from = m.index;
      const to = from + m[0].length;
      if (fm && from < fmEnd) continue;
      if (inCode(from, to)) continue;

      const open = m[0].indexOf(inner);
      const innerFrom = from + open;
      const innerTo = innerFrom + inner.length;
      const reveal = { from, to };
      hide(from, innerFrom, reveal);
      decos.push(Decoration.mark({ class: wrap.cls }).range(innerFrom, innerTo));
      hide(innerTo, to, reveal);
    }
  }

  // <br> 这类无配对标签直接藏掉
  INLINE_VOID_TAGS.lastIndex = 0;
  let voidTag: RegExpExecArray | null;
  while ((voidTag = INLINE_VOID_TAGS.exec(text))) {
    const from = voidTag.index;
    const to = from + voidTag[0].length;
    if (fm && from < fmEnd) continue;
    if (inCode(from, to)) continue;
    hide(from, to, { from, to });
  }

  // YAML Front Matter（fm.to 含结尾换行，块级装饰必须去掉它才是整行区间）
  if (fm) {
    const fmTo = fm.to > 0 && text[fm.to - 1] === "\n" ? fm.to - 1 : fm.to;
    if (coversWholeLines(fm.from, fmTo)) {
      atomicBlocks.push({ from: fm.from, to: fmTo });
      decos.push(
        Decoration.replace({
          widget: new FrontMatterWidget(fm.from, fmTo, fm.raw),
          block: true,
          ...blockReveal(fm.from, fmTo),
        }).range(fm.from, fmTo),
      );
    }
  }

  // 脚注引用 → 编号上标；定义 → 可点击编辑的摘要块
  const fnRe = /\[\^([^\]\n]+)\]/g;
  const footnoteNumbers = new Map<string, number>();
  const footnoteMatches: RegExpExecArray[] = [];
  let fnm: RegExpExecArray | null;
  while ((fnm = fnRe.exec(text))) {
    footnoteMatches.push(fnm);
    const label = normalizeLinkLabel(fnm[1]);
    const line = doc.lineAt(fnm.index);
    const definition = /^\s{0,3}\[\^([^\]]+)\]:/.exec(line.text);
    if (!definition && !footnoteNumbers.has(label)) footnoteNumbers.set(label, footnoteNumbers.size + 1);
  }
  for (const match of footnoteMatches) {
    const label = normalizeLinkLabel(match[1]);
    if (!footnoteNumbers.has(label)) footnoteNumbers.set(label, footnoteNumbers.size + 1);
  }

  const handledFootnoteLines = new Set<number>();
  for (const match of footnoteMatches) {
    const label = normalizeLinkLabel(match[1]);
    const number = footnoteNumbers.get(label) ?? 1;
    const from = match.index;
    const to = from + match[0].length;
    if (fm && from < fmEnd) continue;
    if (inCode(from, to)) continue;

    const line = doc.lineAt(from);
    const definition = /^\s{0,3}\[\^([^\]]+)\]:\s*(.*)$/.exec(line.text);
    if (definition && normalizeLinkLabel(definition[1]) === label) {
      if (handledFootnoteLines.has(line.number)) continue;
      handledFootnoteLines.add(line.number);
      atomicBlocks.push({ from: line.from, to: line.to });
      decos.push(
        Decoration.replace({
          widget: new EditableMetadataWidget(
            line.from,
            line.to,
            line.text,
            tr(getLocale(), "editor.footnote", {
              number,
              text: definition[2],
            }),
            "footnote",
          ),
          block: true,
          ...blockReveal(line.from, line.to),
        }).range(line.from, line.to),
      );
      continue;
    }
    decos.push(
      Decoration.replace({
        widget: new InlinePreviewWidget(from, to, String(number), "cm-md-footnote", "sup"),
        revealFrom: from,
        revealTo: to,
      }).range(from, to),
    );
  }

  // Markdown 的空白源码行只用于分隔块，不应该在所见即所得模式中继续占满
  // 一整行高度；连续空行在渲染语义上也不会制造多份段间距。
  const sortedBlocks = [...atomicBlocks].sort((a, b) => a.from - b.from);
  let blockIndex = 0;
  let previousBlank = false;
  for (let number = 1; number <= doc.lines; number++) {
    const line = doc.line(number);
    while (blockIndex < sortedBlocks.length && sortedBlocks[blockIndex].to < line.from) {
      blockIndex++;
    }
    const block = sortedBlocks[blockIndex];
    const insideBlock = Boolean(block && line.from >= block.from && line.to <= block.to);
    const blank = !insideBlock && line.text.trim().length === 0;
    if (blank) {
      addLineClass(line.from, previousBlank ? "md-blank-line md-blank-line-extra" : "md-blank-line");
    }
    previousBlank = blank;
  }

  return {
    lines: Decoration.set(lineDecos, true),
    statics: Decoration.set(decos, true),
    atomicBlocks,
  };
}

/**
 * 光标所在处露出源码：把光标压住的装饰过滤掉。
 *
 * 判定用的是光标位置（selection.head）而不是整个选区：否则 Ctrl+A 全选会把
 * 整篇文档一次性翻成源码，拖选时也会一路闪烁。
 *
 * 标记类装饰带 revealFrom/revealTo（所属节点的范围），所以光标落在
 * `**粗体**` 中间也会显形，而不是必须压在 `**` 上。
 *
 * `filterFrom/filterTo` 把测试范围限制在光标所在行，其余区块整块保留，
 * 因此移动光标的开销与文档长度无关。
 */
function applySelection(statics: DecorationSet, state: EditorState): DecorationSet {
  const doc = state.doc;
  const head = state.selection.main.head;
  const line = doc.lineAt(head);
  return statics.update({
    filter: (dFrom, dTo, value) => {
      const spec = value.spec as { revealFrom?: number; revealTo?: number } | null;
      const revealFrom = spec?.revealFrom ?? dFrom;
      const revealTo = spec?.revealTo ?? dTo;
      return head < revealFrom || head > revealTo;
    },
    filterFrom: line.from,
    filterTo: line.to,
  });
}

const rebuildPreviewEffect = StateEffect.define<void>();

/** 光标以整块为单位跳过这些区域（块内部有自己的编辑器） */
const ATOMIC_MARK = Decoration.mark({});

function atomicBlockRanges(sets: PreviewSets): DecorationSet {
  if (!sets.atomicBlocks.length) return Decoration.none;
  return Decoration.set(
    sets.atomicBlocks.map((b) => ATOMIC_MARK.range(b.from, b.to)),
    true,
  );
}

function livePreview(ctx: { filePath: string | null }): Extension {
  return StateField.define<PreviewSets>({
    create(state) {
      const built = buildPreviewSets(state, ctx.filePath);
      return { ...built, visible: applySelection(built.statics, state) };
    },
    update(value, tr) {
      if (tr.docChanged || tr.effects.some((e) => e.is(rebuildPreviewEffect))) {
        const built = buildPreviewSets(tr.state, ctx.filePath);
        return { ...built, visible: applySelection(built.statics, tr.state) };
      }
      if (!tr.startState.selection.eq(tr.state.selection)) {
        return { ...value, visible: applySelection(value.statics, tr.state) };
      }
      return value;
    },
    provide: (f) => [
      EditorView.decorations.from(f, (v) => v.lines),
      EditorView.decorations.from(f, (v) => v.visible),
      EditorView.atomicRanges.of((view) => {
        const v = view.state.field(f, false);
        return v ? atomicBlockRanges(v) : Decoration.none;
      }),
    ],
  });
}

const previewCompartment = new Compartment();
const typewriterCompartment = new Compartment();
const lineNumbersCompartment = new Compartment();
const wrapCompartment = new Compartment();
const tabSizeCompartment = new Compartment();
const spellCheckCompartment = new Compartment();

function spellCheckExt(enabled: boolean): Extension {
  return EditorView.contentAttributes.of({ spellcheck: enabled ? "true" : "false" });
}

function previewExt(mode: EditorMode, ctx: { filePath: string | null }): Extension {
  return mode === "preview"
    ? [livePreview(ctx), tableSelectionSnap()]
    : [];
}

/**
 * 打字机模式。
 *
 * 必须在更新周期之外派发：CodeMirror 在 `ViewPlugin.update()` 里调用
 * `view.dispatch()` 会抛 "Calls to EditorView.update are not allowed while an
 * update is in progress"，异常被吞掉后整个插件会被 deactivate。
 */
function typewriterExt(enabled: boolean): Extension {
  if (!enabled) return [];
  let frame = 0;
  return EditorView.updateListener.of((u) => {
    if (!u.selectionSet && !u.docChanged) return;
    if (frame) return;
    frame = requestAnimationFrame(() => {
      frame = 0;
      const view = u.view;
      if (!view.dom.isConnected) return;
      view.dispatch({
        effects: EditorView.scrollIntoView(view.state.selection.main.head, { y: "center" }),
      });
    });
  });
}

/**
 * 插入图片。
 *
 * 文档已保存 → 直接写到同目录的 assets/；还没保存 → 先在内存暂存并立刻回显，
 * 等保存时统一落盘。任何情况下都不打断书写去弹保存框。
 */
async function insertImage(
  view: EditorView,
  filePath: string | null,
  bytes: Uint8Array,
  ext = "png",
  mime = "image/png",
) {
  const name = `image-${Date.now()}.${ext}`;
  const rel = `assets/${name}`;

  if (filePath) {
    const abs = `${dirOf(filePath)}/${rel}`.replace(/\\/g, "/");
    try {
      await api.writeBinary(abs, Array.from(bytes));
    } catch (e) {
      editorShowError(e);
      return;
    }
  } else {
    addPendingImage(rel, bytes, mime);
  }

  const insert = `![](${rel})`;
  const pos = view.state.selection.main.head;
  const line = view.state.doc.lineAt(pos);
  const atLineStart = pos === line.from;
  const lineEmpty = line.text.trim().length === 0;
  const block = atLineStart && lineEmpty ? `${insert}\n` : `\n${insert}\n`;
  const endPos = pos + block.length;
  view.dispatch({
    changes: { from: pos, insert: block },
    selection: { anchor: endPos },
    scrollIntoView: true,
    userEvent: "input.image",
  });
  editorShowMessage(
    tr(getLocale(), filePath ? "toast.imageSaved" : "toast.imagePending"),
  );
}

function normalizeWs(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function htmlTextContent(html: string): string {
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    return normalizeWs(doc.body.textContent ?? "");
  } catch {
    return "";
  }
}

function shouldHandleImagePaste(event: ClipboardEvent): boolean {
  const items = event.clipboardData?.items;
  if (!items?.length) return false;

  let hasImageFile = false;
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) hasImageFile = true;
  }
  if (!hasImageFile) return false;

  // 只在剪贴板没有实际文字时按图片处理。
  // 不能因为存在 text/html 就放弃 —— 从浏览器、Word、聊天软件复制图片时，
  // 剪贴板里几乎总会同时塞一份 <img> 的 HTML，之前那条判断把图片粘贴全挡掉了。
  const text = event.clipboardData?.getData("text/plain")?.trim() ?? "";
  return text.length === 0;
}

/** Ctrl+Shift+V 请求「粘贴为纯文本」，由紧随其后的 paste 事件消费 */
let plainPasteRequested = false;

/**
 * ```lang 或 $$ 之后按回车：补上闭合标记并直接进入组件里编辑。
 *
 * 不做这一步的话，未闭合围栏按 CommonMark 会一路吃到文档末尾，
 * 整篇文章都会变成一个代码块。
 */
function openBlockOnEnter(view: EditorView): boolean {
  const { state } = view;
  const sel = state.selection.main;
  if (!sel.empty) return false;

  const line = state.doc.lineAt(sel.head);
  if (sel.head !== line.to) return false;

  const fence = /^(`{3,}|~{3,})([^\s`~]*)\s*$/.exec(line.text);
  const math = /^\$\$\s*$/.test(line.text);
  if (!fence && !math) return false;

  // 已经是完整代码块（比如光标停在被展开的源码里）就别再插一道围栏，
  // 直接进组件编辑
  if (fence) {
    let node: SyntaxNode | null = syntaxTree(state).resolveInner(line.from, 1);
    for (; node; node = node.parent) {
      if (node.name !== "FencedCode") continue;
      if (node.getChildren("CodeMark").length >= 2) {
        focusBlockStartingAt(view, node.from);
        return true;
      }
      break;
    }
  }

  const closing = fence ? fence[1] : "$$";
  const insert = `\n\n${closing}`;
  const blockFrom = line.from;
  const blockTo = line.to + insert.length;

  view.dispatch({
    changes: { from: line.to, insert },
    // 光标先停在块外，随后把焦点交给组件内部的编辑区
    selection: { anchor: blockTo },
    userEvent: "input.block",
    scrollIntoView: true,
  });
  focusBlockStartingAt(view, blockFrom);
  return true;
}

/** 文档首尾没有相邻正文行时，在原子组件边界回车也要能创建空段落。 */
function insertParagraphAtBlockBoundary(view: EditorView): boolean {
  const sel = view.state.selection.main;
  if (!sel.empty) return false;

  const blocks = view.dom.querySelectorAll<HTMLElement>(
    ".md-codeblock-widget, .md-table-widget",
  );
  for (const block of blocks) {
    const range = currentBlockRange(view, block);
    if (!range) continue;
    if (sel.head === range.from) {
      view.dispatch({
        changes: { from: range.from, insert: "\n" },
        selection: { anchor: range.from },
        userEvent: "input",
        scrollIntoView: true,
      });
      return true;
    }
    if (sel.head === range.to) {
      view.dispatch({
        changes: { from: range.to, insert: "\n" },
        selection: { anchor: range.to + 1 },
        userEvent: "input",
        scrollIntoView: true,
      });
      return true;
    }
  }
  return false;
}

function urlAtPos(state: EditorState, pos: number): string | null {
  const tree = syntaxTree(state);
  const definitions = collectLinkDefinitions(tree, state.doc);
  const asUrl = (value: string) => {
    const url = value.replace(/^<|>$/g, "");
    return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(url) ? `mailto:${url}` : url;
  };

  let node: SyntaxNode | null = tree.resolveInner(pos, -1);
  for (; node; node = node.parent) {
    if (node.name === "URL" || node.name === "Autolink") {
      return asUrl(state.doc.sliceString(node.from, node.to));
    }
    if (node.name !== "Link") continue;
    if (state.doc.sliceString(node.from, Math.min(node.to, node.from + 2)) === "[^") return null;

    const direct = node.getChild("URL");
    if (direct) return asUrl(state.doc.sliceString(direct.from, direct.to));

    const marks = node.getChildren("LinkMark");
    const visibleLabel = marks.length >= 2
      ? state.doc.sliceString(marks[0].to, marks[1].from)
      : "";
    const reference = node.getChild("LinkLabel");
    const rawReference = reference
      ? state.doc.sliceString(reference.from + 1, reference.to - 1) || visibleLabel
      : visibleLabel;
    return definitions.get(normalizeLinkLabel(rawReference))?.url ?? null;
  }
  return null;
}

function mediaHandlers(
  ctx: { filePath: string | null },
  onOpenMarkdown?: (content: string, path?: string) => void,
): Extension {
  return EditorView.domEventHandlers({
    paste(event, view) {
      // Ctrl/Cmd+Shift+V：粘贴为纯文本，跳过 HTML → Markdown 转换
      if (plainPasteRequested) {
        plainPasteRequested = false;
        return false;
      }
      const htmlClip = event.clipboardData?.getData("text/html")?.trim() ?? "";
      const plainClip = event.clipboardData?.getData("text/plain") ?? "";
      // 从代码编辑器复制 Markdown 时剪贴板会同时带一份「带语法着色的 HTML」，
      // 两者文字内容相同 —— 这种情况必须按纯文本粘，否则原文会被转换器改写
      const htmlIsJustStyledText =
        !!htmlClip && !!plainClip && htmlTextContent(htmlClip) === normalizeWs(plainClip);

      if (htmlClip && !htmlIsJustStyledText && !shouldHandleImagePaste(event)) {
        const md = htmlToMarkdown(htmlClip);
        if (md.trim().length > 1) {
          event.preventDefault();
          const { from, to } = view.state.selection.main;
          view.dispatch({ changes: { from, to, insert: md }, scrollIntoView: true });
          return true;
        }
      }
      if (!shouldHandleImagePaste(event)) return false;
      const items = event.clipboardData?.items;
      if (!items) return false;
      for (const item of items) {
        if (item.type.startsWith("image/")) {
          event.preventDefault();
          const file = item.getAsFile();
          if (!file) return true;
          void file.arrayBuffer().then((buf) => {
            const ext = file.type.split("/")[1] || "png";
            void insertImage(view, ctx.filePath, new Uint8Array(buf), ext, file.type || "image/png");
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
      const isImage =
        file.type.startsWith("image/") || /\.(png|jpe?g|gif|webp|svg)$/i.test(file.name);
      const isMarkdown = /\.(md|markdown|txt)$/i.test(file.name);

      if (isMarkdown && onOpenMarkdown) {
        event.preventDefault();
        const path = (file as File & { path?: string }).path;
        void file.text().then((text) => {
          onOpenMarkdown(text, path);
        });
        return true;
      }

      if (!isImage) return false;
      event.preventDefault();
      void file.arrayBuffer().then((buf) => {
        const ext = file.name.split(".").pop() || "png";
        void insertImage(view, ctx.filePath, new Uint8Array(buf), ext, file.type || "image/png");
      });
      return true;
    },
    mousedown(event, view) {
      if (event.button !== 0) return false;

      let pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      const target = event.target as HTMLElement;
      // 与 Typora 一致：普通点击是定位光标，Ctrl/Cmd + 点击才打开链接
      if (pos != null && (event.ctrlKey || event.metaKey) && target.closest(".cm-md-link")) {
        const url = urlAtPos(view.state, pos);
        if (url) {
          event.preventDefault();
          void openUrl(url).catch(() => editorShowError(url));
          return true;
        }
      }

      const taskLine = target.closest(".cm-line.md-task-item");
      if (!taskLine) return false;

      if (pos == null) {
        pos = view.posAtDOM(taskLine, 0);
      }
      if (pos == null) return false;

      const line = view.state.doc.lineAt(pos);
      const m = TASK_LINE_RE.exec(line.text);
      if (!m) return false;

      const bracketPos = line.from + m[1].length;
      const onBrackets = pos >= bracketPos && pos <= bracketPos + 3;

      const rect = taskLine.getBoundingClientRect();
      const CHECKBOX_HIT = 40;
      const onCheckboxVisual = event.clientX - rect.left < CHECKBOX_HIT;

      if (!onBrackets && !onCheckboxVisual) return false;

      const checked = m[2].toLowerCase() === "x";
      const newMark = checked ? " " : "x";
      view.dispatch({
        changes: { from: bracketPos + 1, to: bracketPos + 2, insert: newMark },
        userEvent: "input.toggleTask",
      });
      event.preventDefault();
      return true;
    },
    keydown(event, view) {
      if (event.key === "Control" || event.key === "Meta") {
        view.dom.classList.add("cm-mod-held");
      }
      if ((event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "v") {
        plainPasteRequested = true;
        // 兜底：粘贴事件没来（比如被系统吞了）就自动复位
        window.setTimeout(() => { plainPasteRequested = false; }, 500);
      }
      return false;
    },
    keyup(event, view) {
      if (event.key === "Control" || event.key === "Meta") {
        view.dom.classList.remove("cm-mod-held");
      }
      return false;
    },
    blur(_event, view) {
      view.dom.classList.remove("cm-mod-held");
      return false;
    },
  });
}

export type { EditorAction };

export interface EditorHandle {
  view: EditorView;
  setMode: (m: EditorMode) => void;
  setFilePath: (path: string | null) => void;
  setTypewriter: (on: boolean) => void;
  setLineNumbers: (on: boolean) => void;
  setWordWrap: (on: boolean) => void;
  setTabSize: (n: number) => void;
  setSpellCheck: (on: boolean) => void;
  scrollToLine: (line: number) => void;
  runAction: (action: EditorAction) => boolean;
  insertTable: (rows: number, cols: number) => boolean;
  destroy: () => void;
}

export interface EditorOptions {
  mode: EditorMode;
  filePath: string | null;
  typewriter: boolean;
  lineNumbers: boolean;
  wordWrap: boolean;
  tabSize: number;
  spellCheck: boolean;
  onChange: (doc: string) => void;
  onModeChange: (m: EditorMode) => void;
  onCursorLine?: (line: number) => void;
  onOpenMarkdown?: (content: string, path?: string) => void;
  onViewportRange?: (from: number, to: number) => void;
}

export function createEditor(
  parent: HTMLElement,
  initialDoc: string,
  opts: EditorOptions,
): EditorHandle {
  let mode = opts.mode;
  let typewriter = opts.typewriter;
  const assetContext = { filePath: opts.filePath };

  function toggleMode() {
    mode = mode === "preview" ? "source" : "preview";
    view.dispatch({
      effects: previewCompartment.reconfigure(previewExt(mode, assetContext)),
    });
    opts.onModeChange(mode);
  }

  const state = EditorState.create({
    doc: initialDoc,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      // 默认不画高亮底色，只是给当前行打标记，供专注模式变暗使用
      highlightActiveLine(),
      lineNumbersCompartment.of(opts.lineNumbers ? lineNumbers() : []),
      wrapCompartment.of(opts.wordWrap ? EditorView.lineWrapping : []),
      tabSizeCompartment.of(EditorState.tabSize.of(opts.tabSize)),
      spellCheckCompartment.of(spellCheckExt(opts.spellCheck)),
      markdown({ base: markdownLanguage }),
      syntaxHighlighting(markdownHighlight),
      // 必须排在 defaultKeymap 之前，否则退格删整对不生效
      bracketExtensions(),
      keymap.of([
        // 与 App 的全局 Ctrl+/ 冲突：不阻断冒泡的话会被切回来
        { key: "Mod-/", run: () => { toggleMode(); return true; }, stopPropagation: true },
        ...editorActionKeymap(),
        // 组件位于文档首尾时，边界没有相邻正文行可承接原生回车
        { key: "Enter", run: (v: EditorView) => mode === "preview" && insertParagraphAtBlockBoundary(v) },
        // ```java + 回车 直接生成 java 代码块（$$ 同理）
        { key: "Enter", run: (v: EditorView) => mode === "preview" && openBlockOnEnter(v) },
        // 块级组件是原子区间，光标会整块跳过；在边界上把焦点交给组件内部编辑器
        { key: "ArrowDown", run: (v: EditorView) => enterAdjacentBlock(v, true, false) },
        { key: "ArrowUp", run: (v: EditorView) => enterAdjacentBlock(v, false, false) },
        { key: "ArrowRight", run: (v: EditorView) => enterAdjacentBlock(v, true, true) },
        { key: "ArrowLeft", run: (v: EditorView) => enterAdjacentBlock(v, false, true) },
        { key: "Tab", run: tableTab },
        { key: "Shift-Tab", run: tableShiftTab },
        { key: "Backspace", run: tableBackspace },
        { key: "Delete", run: tableDeleteKey },
        // markdownKeymap 必须排在 defaultKeymap 前面，否则回车续列表会被
        // insertNewlineAndIndent 抢先处理掉
        ...markdownKeymap,
        ...defaultKeymap,
        ...historyKeymap,
        ...searchKeymap,
        indentWithTab,
      ]),
      search({ top: true }),
      highlightSelectionMatches(),
      previewCompartment.of(previewExt(mode, assetContext)),
      typewriterCompartment.of(typewriterExt(typewriter)),
      mediaHandlers(assetContext, opts.onOpenMarkdown),
      EditorView.updateListener.of((u) => {
        if (u.docChanged) opts.onChange(documentText(u.state.doc));
        if (u.selectionSet) {
          const line = u.state.doc.lineAt(u.state.selection.main.head).number;
          opts.onCursorLine?.(line);
        }
        if (u.viewportChanged || u.selectionSet) {
          const from = u.state.doc.lineAt(u.view.viewport.from).number;
          const to = u.state.doc.lineAt(u.view.viewport.to).number;
          opts.onViewportRange?.(from, to);
        }
      }),
    ],
  });

  const view = new EditorView({ state, parent });

  return {
    view,
    setMode: (m: EditorMode) => {
      if (m !== mode) toggleMode();
    },
    setFilePath: (path: string | null) => {
      if (assetContext.filePath === path) return;
      assetContext.filePath = path;
      if (mode === "preview") {
        view.dispatch({ effects: rebuildPreviewEffect.of() });
      }
    },
    setTypewriter: (on: boolean) => {
      if (on === typewriter) return;
      typewriter = on;
      view.dispatch({
        effects: typewriterCompartment.reconfigure(typewriterExt(typewriter)),
      });
    },
    setLineNumbers: (on: boolean) => {
      view.dispatch({
        effects: lineNumbersCompartment.reconfigure(on ? lineNumbers() : []),
      });
    },
    setWordWrap: (on: boolean) => {
      view.dispatch({
        effects: wrapCompartment.reconfigure(on ? EditorView.lineWrapping : []),
      });
    },
    setTabSize: (n: number) => {
      view.dispatch({
        effects: tabSizeCompartment.reconfigure(EditorState.tabSize.of(n)),
      });
    },
    setSpellCheck: (on: boolean) => {
      view.dispatch({
        effects: spellCheckCompartment.reconfigure(spellCheckExt(on)),
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
    runAction: (action: EditorAction) => runEditorAction(view, action),
    insertTable: (rows: number, cols: number) => insertTableAtCursor(view, rows, cols),
    destroy: () => view.destroy(),
  };
}
