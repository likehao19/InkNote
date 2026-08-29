/** 路径拼接 */
export function joinPath(dir: string, name: string): string {
  const sep = dir.includes("\\") ? "\\" : "/";
  return `${dir.replace(/[\\/]+$/, "")}${sep}${name}`;
}

/** 跨平台安全的单一文件/目录名称，不允许路径分隔符或 Windows 保留名。 */
export function isValidEntryName(name: string): boolean {
  if (
    !name ||
    name !== name.trim() ||
    name === "." ||
    name === ".." ||
    /[<>:"/\\|?*\u0000-\u001f]/.test(name) ||
    /[. ]$/.test(name)
  ) return false;

  const stem = name.split(".", 1)[0].toUpperCase();
  return !/^(?:CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])$/.test(stem);
}

/** 取路径最后一段名称 */
export function basename(path: string): string {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).pop() || path;
}

/** 取文件所在目录 */
export function dirOf(filePath: string): string {
  const parts = filePath.replace(/[\\/]+$/, "").split(/[\\/]/);
  parts.pop();
  return parts.join("/") || filePath;
}

/** 相对路径（用于 Markdown 图片引用） */
export function relativePath(fromDir: string, absPath: string): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const from = norm(fromDir).replace(/\/$/, "");
  const to = norm(absPath);
  if (to.startsWith(from + "/")) return to.slice(from.length + 1);
  return to;
}

/** 相对工作区根目录的路径 */
export function relativeToWorkspace(root: string, target: string): string {
  const norm = (p: string) => p.replace(/\\/g, "/");
  const base = norm(root).replace(/\/$/, "");
  const path = norm(target);
  if (path.startsWith(`${base}/`)) return path.slice(base.length + 1);
  return path;
}

/** 路径重命名后，更新子路径前缀 */
export function remapPath(path: string, oldPath: string, newPath: string): string {
  if (path === oldPath) return newPath;
  const sep = oldPath.includes("\\") ? "\\" : "/";
  const prefix = `${oldPath}${sep}`;
  if (path.startsWith(prefix)) return `${newPath}${sep}${path.slice(prefix.length)}`;
  return path;
}

/** 判断路径是否在目录下（含自身） */
export function isPathUnder(path: string, dir: string): boolean {
  if (path === dir) return true;
  const sep = dir.includes("\\") ? "\\" : "/";
  return path.startsWith(`${dir}${sep}`);
}

/** 将 Markdown 中的相对图片路径解析为绝对路径 */
export function resolveAssetPath(mdPath: string | null, src: string): string {
  if (!src || /^https?:\/\//i.test(src) || /^data:/i.test(src)) return src;
  if (!mdPath) return src;
  const base = dirOf(mdPath);
  const sep = mdPath.includes("\\") ? "\\" : "/";
  if (src.startsWith("/") || /^[A-Za-z]:/.test(src)) return src;
  let decoded = src;
  try {
    decoded = decodeURIComponent(src);
  } catch {
    // Keep malformed user-authored paths unchanged.
  }
  return `${base}${sep}${decoded.replace(/\//g, sep)}`;
}
