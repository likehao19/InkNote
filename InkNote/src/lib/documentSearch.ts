export interface DocumentSearchMatch {
  from: number;
  to: number;
  line: number;
  lineText: string;
  lineStart: number;
  lineEnd: number;
}

export function collectDocumentMatches(content: string, query: string, caseSensitive: boolean, useRegex: boolean): DocumentSearchMatch[] {
  if (!query) return [];
  let expression: RegExp;
  try {
    const pattern = useRegex ? query : query.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    expression = new RegExp(pattern, caseSensitive ? "g" : "gi");
  } catch {
    return [];
  }

  const matches: DocumentSearchMatch[] = [];
  const lines = content.split("\n");
  let offset = 0;
  for (let index = 0; index < lines.length; index++) {
    const lineText = lines[index];
    expression.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = expression.exec(lineText))) {
      matches.push({
        from: offset + match.index,
        to: offset + match.index + match[0].length,
        line: index + 1,
        lineText,
        lineStart: match.index,
        lineEnd: match.index + match[0].length,
      });
      if (!match[0].length) expression.lastIndex++;
    }
    offset += lineText.length + 1;
  }
  return matches;
}
