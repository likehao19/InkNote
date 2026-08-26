export const IMAGE_ASSET_DIR = ".inknote-assets";

export function isManagedImageAssetDir(name: string): boolean {
  return name.toLowerCase() === IMAGE_ASSET_DIR;
}

export type ManagedImageReference = {
  source: string;
  fileName: string;
};

function decodedPath(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function managedReference(source: string): ManagedImageReference | null {
  const normalized = decodedPath(source.trim()).replace(/\\/g, "/").replace(/^\.\//, "");
  const parts = normalized.split("/");
  if (parts.length !== 2 || !isManagedImageAssetDir(parts[0]) || !parts[1]) return null;
  if (parts[1] === "." || parts[1] === "..") return null;
  return { source, fileName: parts[1] };
}

/** 仅提取 InkNote 自己生成的同级资源引用，避免误操作外部或用户管理的图片。 */
export function extractManagedImageReferences(markdown: string): ManagedImageReference[] {
  const found = new Map<string, ManagedImageReference>();
  const add = (source: string | undefined) => {
    if (!source) return;
    const reference = managedReference(source);
    if (reference) found.set(reference.source, reference);
  };

  const markdownImage = /!\[[^\]\r\n]*\]\(\s*(?:<([^>\r\n]+)>|([^\s)"']+))(?:\s+["'][^"'\r\n]*["'])?\s*\)/g;
  for (const match of markdown.matchAll(markdownImage)) add(match[1] ?? match[2]);

  const normalizeLabel = (label: string) => label.trim().replace(/\s+/g, " ").toLowerCase();
  const definitions = new Map<string, string>();
  const definition = /^\s{0,3}\[([^\]\r\n]+)\]:\s*(?:<([^>\r\n]+)>|([^\s"']+))(?:\s+(?:["'(][^\r\n]*["')]))?\s*$/gm;
  for (const match of markdown.matchAll(definition)) {
    definitions.set(normalizeLabel(match[1]), match[2] ?? match[3]);
  }

  const referenceImage = /!\[([^\]\r\n]*)\](?:\[([^\]\r\n]*)\])?/g;
  for (const match of markdown.matchAll(referenceImage)) {
    if (markdown[match.index + match[0].length] === "(") continue;
    const label = match[2] === undefined || match[2] === "" ? match[1] : match[2];
    add(definitions.get(normalizeLabel(label)));
  }

  const htmlImage = /<img\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi;
  for (const match of markdown.matchAll(htmlImage)) add(match[1]);

  return [...found.values()];
}

export function rewriteManagedImageReferences(
  markdown: string,
  replacements: ReadonlyMap<string, string>,
): string {
  let result = markdown;
  for (const [source, replacement] of replacements) {
    result = result.split(source).join(replacement);
  }
  return result;
}
