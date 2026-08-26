import { Menu, MenuItem, PredefinedMenuItem, Submenu } from "@tauri-apps/api/menu";
import { isMac } from "./platform";
import { t, type Locale, type MessageKey } from "./i18n";

export const NATIVE_MENU_EVENT = "inknote-native-menu";

function dispatch(id: string) {
  window.dispatchEvent(new CustomEvent<string>(NATIVE_MENU_EVENT, { detail: id }));
}

async function command(id: string, text: string, accelerator?: string) {
  return MenuItem.new({ id, text, accelerator, action: dispatch });
}

async function separator() {
  return PredefinedMenuItem.new({ item: "Separator" });
}

export async function setupMacNativeMenu(locale: Locale): Promise<void> {
  if (!isMac) return;
  const tr = (key: MessageKey) => t(locale, key);

  const appMenu = await Submenu.new({
    text: "InkNote",
    items: [
      await command("about", tr("menu.about")),
      await separator(),
      await command("settings", tr("menu.settings"), "CmdOrCtrl+,"),
      await separator(),
      await PredefinedMenuItem.new({ item: "Services" }),
      await separator(),
      await PredefinedMenuItem.new({ item: "Hide" }),
      await PredefinedMenuItem.new({ item: "HideOthers" }),
      await PredefinedMenuItem.new({ item: "ShowAll" }),
      await separator(),
      await PredefinedMenuItem.new({ item: "Quit" }),
    ],
  });

  const fileMenu = await Submenu.new({
    text: tr("menu.file"),
    items: [
      await command("new", tr("menu.new"), "CmdOrCtrl+N"),
      await command("open", tr("menu.open"), "CmdOrCtrl+O"),
      await command("open-folder", tr("menu.openFolder")),
      await command("quick-open", tr("menu.quickOpen"), "CmdOrCtrl+P"),
      await separator(),
      await command("close-file", tr("menu.close"), "CmdOrCtrl+W"),
      await command("reopen-closed", tr("menu.reopenClosed"), "CmdOrCtrl+Shift+T"),
      await separator(),
      await command("save", tr("menu.save"), "CmdOrCtrl+S"),
      await command("save-as", tr("menu.saveAs"), "CmdOrCtrl+Shift+S"),
      await separator(),
      await command("export-html", tr("menu.exportHtml")),
      await command("export-pdf", tr("menu.exportPdf")),
    ],
  });

  const editMenu = await Submenu.new({
    text: tr("menu.edit"),
    items: [
      await command("editor:undo", tr("menu.undo"), "CmdOrCtrl+Z"),
      await command("editor:redo", tr("menu.redo"), "CmdOrCtrl+Shift+Z"),
      await separator(),
      await command("editor:cut", tr("menu.cut"), "CmdOrCtrl+X"),
      await command("editor:copy", tr("menu.copy"), "CmdOrCtrl+C"),
      await command("editor:paste", tr("menu.paste"), "CmdOrCtrl+V"),
      await command("editor:pastePlain", tr("shortcuts.pastePlain"), "CmdOrCtrl+Shift+V"),
      await command("editor:selectAll", tr("menu.selectAll"), "CmdOrCtrl+A"),
      await separator(),
      await command("editor:find", tr("menu.find"), "CmdOrCtrl+F"),
      await command("editor:findReplace", tr("menu.findReplace"), "Cmd+Alt+F"),
      await command("search-files", tr("menu.globalSearch"), "CmdOrCtrl+Shift+F"),
    ],
  });

  const paragraphItems = [
    ["paragraph", "menu.paragraphText", "CmdOrCtrl+0"],
    ["heading1", "menu.heading1", "CmdOrCtrl+1"],
    ["heading2", "menu.heading2", "CmdOrCtrl+2"],
    ["heading3", "menu.heading3", "CmdOrCtrl+3"],
    ["heading4", "menu.heading4", "CmdOrCtrl+4"],
    ["heading5", "menu.heading5", "CmdOrCtrl+5"],
    ["heading6", "menu.heading6", "CmdOrCtrl+6"],
    ["bulletList", "menu.bulletList", "CmdOrCtrl+Shift+8"],
    ["orderedList", "menu.orderedList", "CmdOrCtrl+Shift+7"],
    ["taskList", "menu.taskList", "CmdOrCtrl+Shift+X"],
    ["blockquote", "menu.blockquote", "CmdOrCtrl+Shift+Q"],
    ["hr", "menu.hr", undefined],
    ["codeBlock", "menu.codeBlock", "CmdOrCtrl+Shift+K"],
    ["toc", "menu.toc", undefined],
    ["table", "menu.table", "CmdOrCtrl+T"],
    ["mathBlock", "menu.mathBlock", "CmdOrCtrl+Shift+M"],
    ["mermaid", "menu.mermaid", undefined],
  ] as const;
  const paragraphMenu = await Submenu.new({
    text: tr("menu.paragraph"),
    items: await Promise.all(paragraphItems.map(([id, key, accelerator]) =>
      command(`editor:${id}`, tr(key), accelerator),
    )),
  });

  const formatItems = [
    ["bold", "menu.bold", "CmdOrCtrl+B"],
    ["italic", "menu.italic", "CmdOrCtrl+I"],
    ["strikethrough", "menu.strikethrough", undefined],
    ["inlineCode", "menu.inlineCode", "CmdOrCtrl+Shift+`"],
    ["highlight", "menu.highlight", undefined],
    ["underline", "menu.underline", undefined],
    ["superscript", "menu.superscript", undefined],
    ["subscript", "menu.subscript", undefined],
    ["link", "menu.link", "CmdOrCtrl+K"],
    ["image", "menu.image", "CmdOrCtrl+Shift+I"],
    ["copyHtml", "menu.copyHtml", undefined],
  ] as const;
  const formatMenu = await Submenu.new({
    text: tr("menu.format"),
    items: await Promise.all(formatItems.map(([id, key, accelerator]) =>
      command(`editor:${id}`, tr(key), accelerator),
    )),
  });

  const viewMenu = await Submenu.new({
    text: tr("menu.view"),
    items: [
      await command("toggle-sidebar", tr("menu.sidebar"), "CmdOrCtrl+Shift+L"),
      await command("toggle-mode", tr("menu.source"), "CmdOrCtrl+/"),
      await command("focus-mode", tr("menu.focus")),
      await command("typewriter-mode", tr("menu.typewriter")),
      await command("fullscreen", tr("shortcuts.fullscreen"), "Ctrl+Cmd+F"),
      await separator(),
      await command("sidebar-files", tr("menu.files")),
      await command("sidebar-outline", tr("menu.outline")),
      await command("sidebar-recent", tr("menu.recent")),
    ],
  });

  const windowMenu = await Submenu.new({
    text: locale === "zh" ? "窗口" : "Window",
    items: [
      await PredefinedMenuItem.new({ item: "Minimize" }),
      await PredefinedMenuItem.new({ item: "BringAllToFront" }),
    ],
  });
  await windowMenu.setAsWindowsMenuForNSApp();

  const helpMenu = await Submenu.new({
    text: tr("menu.help"),
    items: [
      await command("shortcuts", tr("menu.shortcuts")),
      await command("check-updates", tr("menu.checkUpdates")),
    ],
  });
  await helpMenu.setAsHelpMenuForNSApp();

  const menu = await Menu.new({
    items: [appMenu, fileMenu, editMenu, paragraphMenu, formatMenu, viewMenu, windowMenu, helpMenu],
  });
  await menu.setAsAppMenu();
}
