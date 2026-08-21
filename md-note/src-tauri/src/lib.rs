use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use std::path::Path;
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[cfg(windows)]
use std::{
    sync::{
        atomic::{AtomicU64, AtomicU8, Ordering},
        mpsc, Arc,
    },
    time::Duration,
};
#[cfg(windows)]
use tauri::{webview::PageLoadEvent, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use webview2_com::{Microsoft::Web::WebView2::Win32::ICoreWebView2_7, PrintToPdfCompletedHandler};
#[cfg(windows)]
use windows_core::{Interface, PCWSTR};

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

#[cfg(windows)]
type PdfExportResult = Result<(), String>;

#[cfg(windows)]
fn finish_pdf_export(
    sender: &Arc<Mutex<Option<mpsc::Sender<PdfExportResult>>>>,
    result: PdfExportResult,
) {
    if let Some(sender) = sender.lock().unwrap().take() {
        let _ = sender.send(result);
    }
}

#[cfg(windows)]
#[tauri::command]
async fn export_pdf(app: tauri::AppHandle, path: String, html: String) -> PdfExportResult {
    static NEXT_EXPORT_ID: AtomicU64 = AtomicU64::new(1);

    let export_id = NEXT_EXPORT_ID.fetch_add(1, Ordering::Relaxed);
    let label = format!("pdf-export-{export_id}");
    let temp_path = std::env::temp_dir().join(format!("inknote-pdf-{export_id}.html"));
    std::fs::write(&temp_path, html).map_err(|e| e.to_string())?;

    let file_url = tauri::Url::from_file_path(&temp_path)
        .map_err(|_| "Could not create the temporary PDF export URL".to_string())?;
    let file_url_wide = Arc::new(
        file_url
            .as_str()
            .encode_utf16()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>(),
    );
    let output_path_wide = Arc::new(
        path.encode_utf16()
            .chain(std::iter::once(0))
            .collect::<Vec<_>>(),
    );
    let stage = Arc::new(AtomicU8::new(0));
    let (sender, receiver) = mpsc::channel::<PdfExportResult>();
    let sender = Arc::new(Mutex::new(Some(sender)));

    let callback_sender = Arc::clone(&sender);
    let callback_stage = Arc::clone(&stage);
    let callback_file_url = Arc::clone(&file_url_wide);
    let callback_output_path = Arc::clone(&output_path_wide);
    let callback_temp_path = temp_path.clone();
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::App("pdf-export.html".into()))
        .title("InkNote PDF Export")
        .visible(false)
        .focusable(false)
        .on_page_load(move |window, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished) {
                return;
            }

            match callback_stage.fetch_add(1, Ordering::SeqCst) {
                0 => {
                    let sender = Arc::clone(&callback_sender);
                    let file_url = Arc::clone(&callback_file_url);
                    let temp_path = callback_temp_path.clone();
                    let close_window = window.clone();
                    let dispatch = window.with_webview(move |webview| {
                        let result = unsafe {
                            webview
                                .controller()
                                .CoreWebView2()
                                .and_then(|core| core.Navigate(PCWSTR(file_url.as_ptr())))
                        }
                        .map_err(|e| e.to_string());
                        if let Err(error) = result {
                            let _ = std::fs::remove_file(temp_path);
                            finish_pdf_export(&sender, Err(error));
                            let _ = close_window.close();
                        }
                    });
                    if let Err(error) = dispatch {
                        let _ = std::fs::remove_file(&callback_temp_path);
                        finish_pdf_export(&callback_sender, Err(error.to_string()));
                        let _ = window.close();
                    }
                }
                1 => {
                    let sender = Arc::clone(&callback_sender);
                    let output_path = Arc::clone(&callback_output_path);
                    let temp_path = callback_temp_path.clone();
                    let close_window = window.clone();
                    let dispatch = window.with_webview(move |webview| {
                        let completion_sender = Arc::clone(&sender);
                        let completion_temp_path = temp_path.clone();
                        let completion_window = close_window.clone();
                        let handler = PrintToPdfCompletedHandler::create(Box::new(
                            move |error, succeeded| {
                                let result = match (error, succeeded) {
                                    (Ok(()), true) => Ok(()),
                                    (Err(error), _) => Err(error.to_string()),
                                    _ => Err("WebView2 could not create the PDF file".to_string()),
                                };
                                let _ = std::fs::remove_file(completion_temp_path);
                                finish_pdf_export(&completion_sender, result);
                                let _ = completion_window.close();
                                Ok(())
                            },
                        ));

                        let result = unsafe {
                            webview
                                .controller()
                                .CoreWebView2()
                                .and_then(|core| core.cast::<ICoreWebView2_7>())
                                .and_then(|core| {
                                    core.PrintToPdf(PCWSTR(output_path.as_ptr()), None, &handler)
                                })
                        }
                        .map_err(|e| e.to_string());
                        if let Err(error) = result {
                            let _ = std::fs::remove_file(temp_path);
                            finish_pdf_export(&sender, Err(error));
                            let _ = close_window.close();
                        }
                    });
                    if let Err(error) = dispatch {
                        let _ = std::fs::remove_file(&callback_temp_path);
                        finish_pdf_export(&callback_sender, Err(error.to_string()));
                        let _ = window.close();
                    }
                }
                _ => {}
            }
        })
        .build()
        .map_err(|e| {
            let _ = std::fs::remove_file(&temp_path);
            e.to_string()
        })?;

    let result = tauri::async_runtime::spawn_blocking(move || {
        receiver
            .recv_timeout(Duration::from_secs(60))
            .map_err(|_| "PDF export timed out".to_string())?
    })
    .await
    .map_err(|e| e.to_string())?;

    if result.is_err() {
        let _ = window.close();
        let _ = std::fs::remove_file(temp_path);
    }
    result
}

#[cfg(not(windows))]
#[tauri::command]
async fn export_pdf(_app: tauri::AppHandle, _path: String, _html: String) -> Result<(), String> {
    Err("Direct PDF export is currently supported on Windows only".to_string())
}

fn settings_file(app: &tauri::AppHandle) -> Result<std::path::PathBuf, String> {
    app.path()
        .app_config_dir()
        .map(|dir| dir.join("settings.json"))
        .map_err(|e| e.to_string())
}

#[tauri::command]
fn load_app_settings(app: tauri::AppHandle) -> Result<serde_json::Value, String> {
    let path = settings_file(&app)?;
    if !path.exists() {
        return Ok(serde_json::json!({}));
    }
    let content = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    serde_json::from_str(&content).map_err(|e| format!("设置文件格式错误: {e}"))
}

#[tauri::command]
fn save_app_settings(app: tauri::AppHandle, settings: serde_json::Value) -> Result<(), String> {
    let path = settings_file(&app)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let content = serde_json::to_string_pretty(&settings).map_err(|e| e.to_string())?;
    std::fs::write(path, format!("{content}\n")).map_err(|e| e.to_string())
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
        .ok_or("invalid_source_file")?
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
        return Err("directory_exists".to_string());
    }
    if let Some(parent) = p.parent() {
        if !parent.exists() {
            return Err("parent_directory_missing".to_string());
        }
    }
    std::fs::create_dir(p).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(path: String, content: String) -> Result<(), String> {
    let p = Path::new(&path);
    if p.exists() {
        return Err("file_exists".to_string());
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
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
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
            export_pdf,
            list_dir,
            get_startup_file,
            load_app_settings,
            save_app_settings,
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
