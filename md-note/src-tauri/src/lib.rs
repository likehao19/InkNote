use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Mutex;
use tauri::Emitter;

struct AppState {
    startup_file: Mutex<Option<String>>,
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched_path: Mutex<Option<String>>,
    dir_watcher: Mutex<Option<RecommendedWatcher>>,
    watched_dir: Mutex<Option<String>>,
}

#[derive(serde::Serialize)]
struct DirEntry {
    name: String,
    path: String,
    is_dir: bool,
}

fn is_markdown(path: &str) -> bool {
    let lower = path.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".markdown") || lower.ends_with(".txt")
}

fn find_markdown_file(args: &[String]) -> Option<String> {
    args.iter().skip(1).find(|a| is_markdown(a)).cloned()
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    std::fs::read_to_string(&path).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    std::fs::write(&path, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn write_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = Path::new(&path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&path, data).map_err(|e| e.to_string())
}

#[tauri::command]
fn list_dir(path: String) -> Result<Vec<DirEntry>, String> {
    let mut entries: Vec<DirEntry> = Vec::new();
    for entry in std::fs::read_dir(&path).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let is_dir = entry.file_type().map(|t| t.is_dir()).unwrap_or(false);
        let name = entry.file_name().to_string_lossy().to_string();
        entries.push(DirEntry {
            path: entry.path().to_string_lossy().to_string(),
            name,
            is_dir,
        });
    }
    entries.sort_by(|a, b| {
        b.is_dir
            .cmp(&a.is_dir)
            .then_with(|| a.name.to_lowercase().cmp(&b.name.to_lowercase()))
    });
    Ok(entries)
}

#[tauri::command]
fn get_startup_file(state: tauri::State<AppState>) -> Option<String> {
    state.startup_file.lock().unwrap().take()
}

#[tauri::command]
fn watch_file(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    path: String,
) -> Result<(), String> {
    {
        let watched = state.watched_path.lock().unwrap();
        if watched.as_deref() == Some(path.as_str()) {
            return Ok(());
        }
    }

    let mut watcher_guard = state.watcher.lock().unwrap();
    *watcher_guard = None;

    let emit_path = path.clone();
    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let relevant = matches!(
                    event.kind,
                    EventKind::Modify(_) | EventKind::Create(_) | EventKind::Any
                );
                if relevant {
                    let _ = app_handle.emit("file-changed", emit_path.clone());
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::NonRecursive)
        .map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);
    *state.watched_path.lock().unwrap() = Some(path);
    Ok(())
}

#[tauri::command]
fn unwatch_file(state: tauri::State<AppState>) {
    *state.watcher.lock().unwrap() = None;
    *state.watched_path.lock().unwrap() = None;
}

#[tauri::command]
fn watch_dir(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    path: String,
) -> Result<(), String> {
    {
        let watched = state.watched_dir.lock().unwrap();
        if watched.as_deref() == Some(path.as_str()) {
            return Ok(());
        }
    }

    let mut watcher_guard = state.dir_watcher.lock().unwrap();
    *watcher_guard = None;

    let emit_path = path.clone();
    let app_handle = app.clone();
    let mut watcher = RecommendedWatcher::new(
        move |res: Result<notify::Event, notify::Error>| {
            if let Ok(event) = res {
                let relevant = matches!(
                    event.kind,
                    EventKind::Modify(_)
                        | EventKind::Create(_)
                        | EventKind::Remove(_)
                        | EventKind::Any
                );
                if relevant {
                    let _ = app_handle.emit("dir-changed", emit_path.clone());
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;

    watcher
        .watch(Path::new(&path), RecursiveMode::Recursive)
        .map_err(|e| e.to_string())?;

    *watcher_guard = Some(watcher);
    *state.watched_dir.lock().unwrap() = Some(path);
    Ok(())
}

#[tauri::command]
fn unwatch_dir(state: tauri::State<AppState>) {
    *state.dir_watcher.lock().unwrap() = None;
    *state.watched_dir.lock().unwrap() = None;
}

#[tauri::command]
fn copy_file_to_dir(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let name = src_path
        .file_name()
        .ok_or("无效源文件")?
        .to_string_lossy()
        .to_string();
    let dest = Path::new(&dest_dir).join(&name);
    std::fs::copy(src_path, &dest).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn create_dir(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("目录已存在".to_string());
    }
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            return Err("父目录不存在".to_string());
        }
    }
    std::fs::create_dir(p).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("文件已存在".to_string());
    }
    if let Some(parent) = p.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, content).map_err(|e| e.to_string())
}

#[tauri::command]
fn rename_path(old_path: String, new_path: String) -> Result<(), String> {
    std::fs::rename(&old_path, &new_path).map_err(|e| e.to_string())
}

#[tauri::command]
fn remove_path(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.is_dir() {
        std::fs::remove_dir_all(p).map_err(|e| e.to_string())
    } else {
        std::fs::remove_file(p).map_err(|e| e.to_string())
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = find_markdown_file(&std::env::args().collect::<Vec<_>>());

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = find_markdown_file(&argv) {
                let _ = app.emit("open-file", path);
            }
        }))
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_os::init())
        .manage(AppState {
            startup_file: Mutex::new(startup_file),
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
            dir_watcher: Mutex::new(None),
            watched_dir: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            read_file,
            write_file,
            write_binary,
            list_dir,
            get_startup_file,
            watch_file,
            unwatch_file,
            watch_dir,
            unwatch_dir,
            copy_file_to_dir,
            create_dir,
            create_file,
            rename_path,
            remove_path,
        ]);

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(url) = urls.into_iter().next() {
                    if let Ok(path) = url.to_file_path() {
                        let _ = _app.emit("open-file", path.to_string_lossy().to_string());
                    }
                }
            }
        });
}
