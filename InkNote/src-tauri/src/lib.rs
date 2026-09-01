use chardetng::EncodingDetector;
use encoding_rs::Encoding;
use notify::{EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use regex::RegexBuilder;
use std::fs::{File, OpenOptions};
use std::io::{self, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64 as FileAtomicU64, Ordering as FileOrdering};
use std::sync::Mutex;
use tauri::{Emitter, Manager};

#[cfg(any(windows, target_os = "macos"))]
use std::{
    sync::{
        atomic::{AtomicU64, AtomicU8, Ordering},
        mpsc, Arc,
    },
    time::Duration,
};
#[cfg(any(windows, target_os = "macos"))]
use tauri::{webview::PageLoadEvent, WebviewUrl, WebviewWindowBuilder};
#[cfg(windows)]
use webview2_com::{Microsoft::Web::WebView2::Win32::ICoreWebView2_7, PrintToPdfCompletedHandler};
#[cfg(windows)]
use windows_core::{Interface, PCWSTR};

struct OpenFileState {
    pending: Option<String>,
    frontend_ready: bool,
}

impl OpenFileState {
    fn receive(&mut self, path: String) -> Option<String> {
        if self.frontend_ready {
            Some(path)
        } else {
            self.pending = Some(path);
            None
        }
    }

    fn register_frontend(&mut self) -> Option<String> {
        self.frontend_ready = true;
        self.pending.take()
    }
}

struct AppState {
    open_file: Mutex<OpenFileState>,
    watcher: Mutex<Option<RecommendedWatcher>>,
    watched_path: Mutex<Option<String>>,
    dir_watcher: Mutex<Option<RecommendedWatcher>>,
    watched_dirs: Mutex<Vec<String>>,
}

static NEXT_TEMP_FILE_ID: FileAtomicU64 = FileAtomicU64::new(1);

fn create_temporary_sibling(path: &Path) -> Result<(PathBuf, File), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "parent_directory_missing".to_string())?;
    let name = path
        .file_name()
        .and_then(|value| value.to_str())
        .unwrap_or("document");
    for _ in 0..128 {
        let id = NEXT_TEMP_FILE_ID.fetch_add(1, FileOrdering::Relaxed);
        let candidate = parent.join(format!(".{name}.inknote-{}-{id}.tmp", std::process::id()));
        match OpenOptions::new()
            .write(true)
            .create_new(true)
            .open(&candidate)
        {
            Ok(file) => return Ok((candidate, file)),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists => continue,
            Err(error) => return Err(error.to_string()),
        }
    }
    Err("temporary_file_name_exhausted".to_string())
}

#[cfg(windows)]
fn replace_file(temp: &Path, target: &Path) -> Result<(), String> {
    use std::os::windows::ffi::OsStrExt;

    #[link(name = "Kernel32")]
    extern "system" {
        fn MoveFileExW(existing: *const u16, target: *const u16, flags: u32) -> i32;
    }

    const MOVEFILE_REPLACE_EXISTING: u32 = 0x1;
    const MOVEFILE_WRITE_THROUGH: u32 = 0x8;
    let existing = temp
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let target = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let moved = unsafe {
        MoveFileExW(
            existing.as_ptr(),
            target.as_ptr(),
            MOVEFILE_REPLACE_EXISTING | MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        Err(std::io::Error::last_os_error().to_string())
    } else {
        Ok(())
    }
}

#[cfg(not(windows))]
fn replace_file(temp: &Path, target: &Path) -> Result<(), String> {
    std::fs::rename(temp, target).map_err(|error| error.to_string())
}

fn write_file_safely(path: &Path, content: &[u8]) -> Result<(), String> {
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|error| error.to_string())?;
    }
    let (temp, mut file) = create_temporary_sibling(path)?;
    let result = (|| {
        file.write_all(content).map_err(|error| error.to_string())?;
        file.sync_all().map_err(|error| error.to_string())?;
        drop(file);
        replace_file(&temp, path)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    result
}

fn copy_file_without_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    let mut source_file = File::open(source).map_err(|error| error.to_string())?;
    let mut destination_file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(destination)
        .map_err(|error| {
            if error.kind() == io::ErrorKind::AlreadyExists {
                "file_exists".to_string()
            } else {
                error.to_string()
            }
        })?;
    let result = (|| {
        io::copy(&mut source_file, &mut destination_file).map_err(|error| error.to_string())?;
        destination_file
            .sync_all()
            .map_err(|error| error.to_string())?;
        let permissions = source_file
            .metadata()
            .map_err(|error| error.to_string())?
            .permissions();
        std::fs::set_permissions(destination, permissions).map_err(|error| error.to_string())
    })();
    if result.is_err() {
        drop(destination_file);
        let _ = std::fs::remove_file(destination);
    }
    result
}

fn copy_file_with_overwrite(source: &Path, destination: &Path) -> Result<(), String> {
    let mut source_file = File::open(source).map_err(|error| error.to_string())?;
    let (temp, mut temp_file) = create_temporary_sibling(destination)?;
    let result = (|| {
        io::copy(&mut source_file, &mut temp_file).map_err(|error| error.to_string())?;
        temp_file.sync_all().map_err(|error| error.to_string())?;
        let permissions = source_file
            .metadata()
            .map_err(|error| error.to_string())?
            .permissions();
        std::fs::set_permissions(&temp, permissions).map_err(|error| error.to_string())?;
        drop(temp_file);
        replace_file(&temp, destination)
    })();
    if result.is_err() {
        let _ = std::fs::remove_file(&temp);
    }
    result
}

fn is_valid_entry_name(name: &str) -> bool {
    if name.is_empty()
        || name != name.trim()
        || name == "."
        || name == ".."
        || name.ends_with(['.', ' '])
        || name.chars().any(|character| {
            character.is_control()
                || matches!(
                    character,
                    '<' | '>' | ':' | '"' | '/' | '\\' | '|' | '?' | '*'
                )
        })
    {
        return false;
    }

    let mut components = Path::new(name).components();
    if !matches!(components.next(), Some(Component::Normal(_))) || components.next().is_some() {
        return false;
    }

    let stem = name
        .split('.')
        .next()
        .unwrap_or_default()
        .to_ascii_uppercase();
    !matches!(stem.as_str(), "CON" | "PRN" | "AUX" | "NUL")
        && !(stem.len() == 4
            && (stem.starts_with("COM") || stem.starts_with("LPT"))
            && stem.as_bytes()[3].is_ascii_digit()
            && stem.as_bytes()[3] != b'0')
}

fn entry_path(parent: &str, name: &str) -> Result<PathBuf, String> {
    if !is_valid_entry_name(name) {
        return Err("invalid_file_name".to_string());
    }
    let parent = Path::new(parent);
    if !parent.is_dir() {
        return Err("parent_directory_missing".to_string());
    }
    Ok(parent.join(name))
}

fn available_destination(dest_dir: &Path, source: &Path) -> Result<PathBuf, String> {
    let name = source.file_name().ok_or("invalid_source_file")?;
    let direct = dest_dir.join(name);
    if !direct.exists() && direct != source {
        return Ok(direct);
    }

    let stem = source
        .file_stem()
        .and_then(|value| value.to_str())
        .unwrap_or("file");
    let extension = source.extension().and_then(|value| value.to_str());
    for index in 1..10_000 {
        let candidate_name = match extension {
            Some(ext) => format!("{stem} ({index}).{ext}"),
            None => format!("{stem} ({index})"),
        };
        let candidate = dest_dir.join(candidate_name);
        if !candidate.exists() {
            return Ok(candidate);
        }
    }
    Err("destination_name_exhausted".to_string())
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

fn dispatch_open_file(app: &tauri::AppHandle, path: String) {
    let ready_path = app
        .state::<AppState>()
        .open_file
        .lock()
        .unwrap()
        .receive(path);
    if let Some(path) = ready_path {
        let _ = app.emit("open-file", path);
    }
}

#[derive(Clone, Debug, serde::Deserialize, serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TextEncoding {
    name: String,
    bom: bool,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct TextFileContent {
    content: String,
    encoding: TextEncoding,
}

fn decode_utf16(bytes: &[u8], little_endian: bool) -> Result<String, String> {
    if !bytes.len().is_multiple_of(2) {
        return Err("text_encoding_invalid".to_string());
    }
    let units = bytes.chunks_exact(2).map(|pair| {
        if little_endian {
            u16::from_le_bytes([pair[0], pair[1]])
        } else {
            u16::from_be_bytes([pair[0], pair[1]])
        }
    });
    String::from_utf16(&units.collect::<Vec<_>>()).map_err(|_| "text_encoding_invalid".to_string())
}

fn decode_text_bytes(bytes: &[u8]) -> Result<TextFileContent, String> {
    let (content, encoding) = if let Some(payload) = bytes.strip_prefix(&[0xEF, 0xBB, 0xBF]) {
        (
            std::str::from_utf8(payload)
                .map_err(|_| "text_encoding_invalid".to_string())?
                .to_string(),
            TextEncoding {
                name: "UTF-8".to_string(),
                bom: true,
            },
        )
    } else if let Some(payload) = bytes.strip_prefix(&[0xFF, 0xFE]) {
        (
            decode_utf16(payload, true)?,
            TextEncoding {
                name: "UTF-16LE".to_string(),
                bom: true,
            },
        )
    } else if let Some(payload) = bytes.strip_prefix(&[0xFE, 0xFF]) {
        (
            decode_utf16(payload, false)?,
            TextEncoding {
                name: "UTF-16BE".to_string(),
                bom: true,
            },
        )
    } else if let Ok(content) = std::str::from_utf8(bytes) {
        (
            content.to_string(),
            TextEncoding {
                name: "UTF-8".to_string(),
                bom: false,
            },
        )
    } else {
        let mut detector = EncodingDetector::new();
        detector.feed(bytes, true);
        let detected = detector.guess(None, true);
        let (decoded, had_errors) = detected.decode_without_bom_handling(bytes);
        if had_errors {
            return Err("text_encoding_invalid".to_string());
        }
        (
            decoded.into_owned(),
            TextEncoding {
                name: detected.name().to_string(),
                bom: false,
            },
        )
    };
    Ok(TextFileContent { content, encoding })
}

fn encode_text_content(content: &str, encoding: &TextEncoding) -> Result<Vec<u8>, String> {
    let normalized = encoding.name.to_ascii_lowercase();
    let mut bytes = match normalized.as_str() {
        "utf-8" | "utf8" => content.as_bytes().to_vec(),
        "utf-16le" | "utf16le" => content.encode_utf16().flat_map(u16::to_le_bytes).collect(),
        "utf-16be" | "utf16be" => content.encode_utf16().flat_map(u16::to_be_bytes).collect(),
        _ => {
            let selected = Encoding::for_label(encoding.name.as_bytes())
                .ok_or_else(|| "text_encoding_invalid".to_string())?;
            let (encoded, _, had_errors) = selected.encode(content);
            if had_errors {
                return Err("text_encoding_unrepresentable".to_string());
            }
            encoded.into_owned()
        }
    };

    if encoding.bom {
        let prefix: &[u8] = match normalized.as_str() {
            "utf-8" | "utf8" => &[0xEF, 0xBB, 0xBF],
            "utf-16le" | "utf16le" => &[0xFF, 0xFE],
            "utf-16be" | "utf16be" => &[0xFE, 0xFF],
            _ => &[],
        };
        if !prefix.is_empty() {
            let mut with_bom = Vec::with_capacity(prefix.len() + bytes.len());
            with_bom.extend_from_slice(prefix);
            with_bom.append(&mut bytes);
            bytes = with_bom;
        }
    }
    Ok(bytes)
}

#[tauri::command]
fn read_text_file(path: String) -> Result<TextFileContent, String> {
    let bytes = std::fs::read(path).map_err(|e| e.to_string())?;
    decode_text_bytes(&bytes)
}

#[tauri::command]
fn read_file(path: String) -> Result<String, String> {
    read_text_file(path).map(|file| file.content)
}

#[tauri::command]
fn write_file(path: String, content: String) -> Result<(), String> {
    write_file_safely(Path::new(&path), content.as_bytes())
}

#[tauri::command]
fn write_text_file(path: String, content: String, encoding: TextEncoding) -> Result<(), String> {
    let bytes = encode_text_content(&content, &encoding)?;
    write_file_safely(Path::new(&path), &bytes)
}

#[tauri::command]
fn write_binary(path: String, data: Vec<u8>) -> Result<(), String> {
    let path = Path::new(&path);
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(path)
        .map_err(|error| {
            if error.kind() == io::ErrorKind::AlreadyExists {
                "file_exists".to_string()
            } else {
                error.to_string()
            }
        })?;
    let result = file
        .write_all(&data)
        .and_then(|_| file.sync_all())
        .map_err(|error| error.to_string());
    if result.is_err() {
        drop(file);
        let _ = std::fs::remove_file(path);
    }
    result
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct RegexSearchMatch {
    line: usize,
    line_text: String,
    match_start: usize,
    match_end: usize,
}

fn utf16_offset(value: &str, byte_offset: usize) -> usize {
    value[..byte_offset].encode_utf16().count()
}

#[tauri::command]
fn search_regex(
    name: String,
    text: String,
    query: String,
    filename_only: bool,
) -> Result<Vec<RegexSearchMatch>, String> {
    let regex = RegexBuilder::new(&query)
        .case_insensitive(true)
        .build()
        .map_err(|_| "invalid_regex".to_string())?;
    let mut matches = Vec::new();

    if let Some(found) = regex.find(&name) {
        matches.push(RegexSearchMatch {
            line: 1,
            line_text: name.clone(),
            match_start: utf16_offset(&name, found.start()),
            match_end: utf16_offset(&name, found.end()),
        });
    }
    if filename_only {
        return Ok(matches);
    }

    for (index, line) in text.split('\n').enumerate() {
        for found in regex.find_iter(line) {
            matches.push(RegexSearchMatch {
                line: index + 1,
                line_text: line.to_string(),
                match_start: utf16_offset(line, found.start()),
                match_end: utf16_offset(line, found.end()),
            });
        }
    }
    Ok(matches)
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
    state.open_file.lock().unwrap().register_frontend()
}

#[cfg(any(windows, target_os = "macos"))]
type PdfExportResult = Result<(), String>;

#[cfg(any(windows, target_os = "macos"))]
fn finish_pdf_export(
    sender: &Arc<Mutex<Option<mpsc::Sender<PdfExportResult>>>>,
    result: PdfExportResult,
) {
    if let Some(sender) = sender.lock().unwrap().take() {
        let _ = sender.send(result);
    }
}

#[cfg(target_os = "macos")]
#[tauri::command]
async fn export_pdf(app: tauri::AppHandle, path: String, html: String) -> PdfExportResult {
    static NEXT_EXPORT_ID: AtomicU64 = AtomicU64::new(1);

    let export_id = NEXT_EXPORT_ID.fetch_add(1, Ordering::Relaxed);
    let label = format!("pdf-export-{export_id}");
    let temp_path = std::env::temp_dir().join(format!("inknote-pdf-{export_id}.html"));
    std::fs::write(&temp_path, html).map_err(|e| e.to_string())?;

    let file_url = tauri::Url::from_file_path(&temp_path)
        .map_err(|_| "Could not create the temporary PDF export URL".to_string())?;
    let completed = Arc::new(AtomicU8::new(0));
    let (sender, receiver) = mpsc::channel::<PdfExportResult>();
    let sender = Arc::new(Mutex::new(Some(sender)));

    let callback_sender = Arc::clone(&sender);
    let callback_completed = Arc::clone(&completed);
    let callback_temp_path = temp_path.clone();
    let callback_output_path = PathBuf::from(path);
    let window = WebviewWindowBuilder::new(&app, &label, WebviewUrl::External(file_url))
        .title("InkNote PDF Export")
        .visible(false)
        .focusable(false)
        .on_page_load(move |window, payload| {
            if !matches!(payload.event(), PageLoadEvent::Finished)
                || callback_completed.swap(1, Ordering::SeqCst) != 0
            {
                return;
            }

            let sender = Arc::clone(&callback_sender);
            let output_path = callback_output_path.clone();
            let temp_path = callback_temp_path.clone();
            let close_window = window.clone();
            let dispatch = window.with_webview(move |webview| unsafe {
                use block2::RcBlock;
                use objc2_foundation::{NSData, NSError};
                use objc2_web_kit::WKWebView;

                let completion_sender = Arc::clone(&sender);
                let completion_temp_path = temp_path.clone();
                let completion_window = close_window.clone();
                let handler: RcBlock<dyn Fn(*mut NSData, *mut NSError)> =
                    RcBlock::new(move |data: *mut NSData, error: *mut NSError| {
                        let result = if !error.is_null() {
                            Err("WebKit could not create the PDF file".to_string())
                        } else if data.is_null() {
                            Err("WebKit returned an empty PDF file".to_string())
                        } else {
                            std::fs::write(&output_path, (&*data).to_vec())
                                .map_err(|e| e.to_string())
                        };
                        let _ = std::fs::remove_file(&completion_temp_path);
                        finish_pdf_export(&completion_sender, result);
                        let _ = completion_window.close();
                    });

                let webview = &*webview.inner().cast::<WKWebView>();
                webview.createPDFWithConfiguration_completionHandler(None, &handler);
            });
            if let Err(error) = dispatch {
                let _ = std::fs::remove_file(&callback_temp_path);
                finish_pdf_export(&callback_sender, Err(error.to_string()));
                let _ = window.close();
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

#[cfg(all(not(windows), not(target_os = "macos")))]
#[tauri::command]
async fn export_pdf(_app: tauri::AppHandle, _path: String, _html: String) -> Result<(), String> {
    Err("pdf_export_unsupported".to_string())
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
    write_file_safely(&path, format!("{content}\n").as_bytes())
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
    let target_path = PathBuf::from(&path);
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
                if relevant && event.paths.iter().any(|changed| changed == &target_path) {
                    let _ = app_handle.emit("file-changed", emit_path.clone());
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;

    let watch_target = Path::new(&path)
        .parent()
        .ok_or_else(|| "parent_directory_missing".to_string())?;
    watcher
        .watch(watch_target, RecursiveMode::NonRecursive)
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
fn watch_dirs(
    app: tauri::AppHandle,
    state: tauri::State<AppState>,
    paths: Vec<String>,
) -> Result<(), String> {
    {
        let watched = state.watched_dirs.lock().unwrap();
        if *watched == paths {
            return Ok(());
        }
    }

    let mut watcher_guard = state.dir_watcher.lock().unwrap();
    *watcher_guard = None;

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
                    let changed = event
                        .paths
                        .first()
                        .map(|path| path.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let _ = app_handle.emit("dir-changed", changed);
                }
            }
        },
        notify::Config::default(),
    )
    .map_err(|e| e.to_string())?;

    for path in &paths {
        watcher
            .watch(Path::new(path), RecursiveMode::Recursive)
            .map_err(|e| e.to_string())?;
    }

    *watcher_guard = Some(watcher);
    *state.watched_dirs.lock().unwrap() = paths;
    Ok(())
}

#[tauri::command]
fn unwatch_dir(state: tauri::State<AppState>) {
    *state.dir_watcher.lock().unwrap() = None;
    state.watched_dirs.lock().unwrap().clear();
}

#[tauri::command]
fn copy_file_to_dir(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let dest = available_destination(Path::new(&dest_dir), src_path)?;
    copy_file_without_overwrite(src_path, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_file_to_dir_strict(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let name = src_path.file_name().ok_or("invalid_source_file")?;
    let dest = Path::new(&dest_dir).join(name);
    if dest.exists() || dest == src_path {
        return Err("file_exists".to_string());
    }
    copy_file_without_overwrite(src_path, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn copy_file_to_dir_overwrite(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let name = src_path.file_name().ok_or("invalid_source_file")?;
    let dest = Path::new(&dest_dir).join(name);
    if dest == src_path {
        return Err("invalid_source_file".to_string());
    }
    copy_file_with_overwrite(src_path, &dest)?;
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn move_file_to_dir(src: String, dest_dir: String) -> Result<String, String> {
    let src_path = Path::new(&src);
    let dest = available_destination(Path::new(&dest_dir), src_path)?;
    if std::fs::rename(src_path, &dest).is_err() {
        copy_file_without_overwrite(src_path, &dest)?;
        if let Err(error) = std::fs::remove_file(src_path) {
            let _ = std::fs::remove_file(&dest);
            return Err(error.to_string());
        }
    }
    Ok(dest.to_string_lossy().to_string())
}

#[tauri::command]
fn create_dir(parent_dir: String, name: String) -> Result<(), String> {
    let p = entry_path(&parent_dir, &name)?;
    if p.exists() {
        return Err("directory_exists".to_string());
    }
    std::fs::create_dir(&p).map_err(|e| e.to_string())
}

#[tauri::command]
fn create_file(parent_dir: String, name: String, content: String) -> Result<(), String> {
    let p = entry_path(&parent_dir, &name)?;
    if p.exists() {
        return Err("file_exists".to_string());
    }
    let mut file = OpenOptions::new()
        .write(true)
        .create_new(true)
        .open(&p)
        .map_err(|error| {
            if error.kind() == std::io::ErrorKind::AlreadyExists {
                "file_exists".to_string()
            } else {
                error.to_string()
            }
        })?;
    file.write_all(content.as_bytes())
        .map_err(|error| error.to_string())?;
    file.sync_all().map_err(|error| error.to_string())
}

#[tauri::command]
fn rename_path(old_path: String, new_name: String) -> Result<(), String> {
    let parent = Path::new(&old_path)
        .parent()
        .ok_or_else(|| "parent_directory_missing".to_string())?;
    let new_path = entry_path(&parent.to_string_lossy(), &new_name)?;
    if new_path.exists() {
        return Err("file_exists".to_string());
    }
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

#[tauri::command]
fn supports_in_app_update() -> bool {
    #[cfg(target_os = "linux")]
    {
        std::env::var_os("APPIMAGE").is_some()
    }
    #[cfg(not(target_os = "linux"))]
    {
        true
    }
}

#[cfg(windows)]
#[tauri::command]
fn configure_markdown_default_app() -> Result<&'static str, String> {
    std::process::Command::new("explorer.exe")
        .arg("ms-settings:defaultapps")
        .spawn()
        .map_err(|error| error.to_string())?;
    Ok("opened-settings")
}

#[cfg(target_os = "linux")]
#[tauri::command]
fn configure_markdown_default_app() -> Result<&'static str, String> {
    for mime in ["text/markdown", "text/x-markdown"] {
        let status = std::process::Command::new("xdg-mime")
            .args(["default", "InkNote.desktop", mime])
            .status()
            .map_err(|error| error.to_string())?;
        if !status.success() {
            return Err(format!("xdg-mime failed for {mime}: {status}"));
        }
    }
    Ok("configured")
}

#[cfg(target_os = "macos")]
#[tauri::command]
fn configure_markdown_default_app() -> Result<&'static str, String> {
    use core_foundation::base::TCFType;
    use core_foundation::string::{CFString, CFStringRef};

    #[link(name = "CoreServices", kind = "framework")]
    extern "C" {
        fn UTTypeCreatePreferredIdentifierForTag(
            tag_class: CFStringRef,
            tag: CFStringRef,
            conforming_to: CFStringRef,
        ) -> CFStringRef;
        fn LSSetDefaultRoleHandlerForContentType(
            content_type: CFStringRef,
            role: u32,
            bundle_identifier: CFStringRef,
        ) -> i32;
    }

    const VIEWER_AND_EDITOR_ROLES: u32 = 0x0000_0006;
    let tag_class = CFString::new("public.filename-extension");
    let bundle_identifier = CFString::new("com.inknote.desktop");
    for extension in ["md", "markdown"] {
        let tag = CFString::new(extension);
        let content_type_ref = unsafe {
            UTTypeCreatePreferredIdentifierForTag(
                tag_class.as_concrete_TypeRef(),
                tag.as_concrete_TypeRef(),
                std::ptr::null(),
            )
        };
        if content_type_ref.is_null() {
            return Err(format!("unable to resolve the UTI for .{extension}"));
        }
        let content_type = unsafe { CFString::wrap_under_create_rule(content_type_ref) };
        let status = unsafe {
            LSSetDefaultRoleHandlerForContentType(
                content_type.as_concrete_TypeRef(),
                VIEWER_AND_EDITOR_ROLES,
                bundle_identifier.as_concrete_TypeRef(),
            )
        };
        if status != 0 {
            return Err(format!("LaunchServices returned {status} for .{extension}"));
        }
    }
    Ok("configured")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let startup_file = find_markdown_file(&std::env::args().collect::<Vec<_>>());

    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_autostart::Builder::new()
                .app_name("InkNote")
                .build(),
        )
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(path) = find_markdown_file(&argv) {
                dispatch_open_file(app, path);
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
            open_file: Mutex::new(OpenFileState {
                pending: startup_file,
                frontend_ready: false,
            }),
            watcher: Mutex::new(None),
            watched_path: Mutex::new(None),
            dir_watcher: Mutex::new(None),
            watched_dirs: Mutex::new(Vec::new()),
        })
        .invoke_handler(tauri::generate_handler![
            read_text_file,
            read_file,
            write_text_file,
            write_file,
            write_binary,
            search_regex,
            export_pdf,
            list_dir,
            get_startup_file,
            load_app_settings,
            save_app_settings,
            watch_file,
            unwatch_file,
            watch_dirs,
            unwatch_dir,
            copy_file_to_dir,
            copy_file_to_dir_strict,
            copy_file_to_dir_overwrite,
            move_file_to_dir,
            create_dir,
            create_file,
            rename_path,
            remove_path,
            supports_in_app_update,
            configure_markdown_default_app,
        ]);

    builder
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|_app, _event| {
            #[cfg(target_os = "macos")]
            if let tauri::RunEvent::Opened { urls } = _event {
                if let Some(url) = urls.into_iter().next() {
                    if let Ok(path) = url.to_file_path() {
                        dispatch_open_file(_app, path.to_string_lossy().to_string());
                    }
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::{
        copy_file_with_overwrite, create_temporary_sibling, decode_text_bytes, encode_text_content,
        is_valid_entry_name, search_regex, write_binary, OpenFileState, TextEncoding,
    };

    fn test_directory(name: &str) -> std::path::PathBuf {
        std::env::temp_dir().join(format!(
            "inknote-test-{name}-{}-{}",
            std::process::id(),
            super::NEXT_TEMP_FILE_ID.fetch_add(1, super::FileOrdering::Relaxed)
        ))
    }

    #[test]
    fn open_file_waits_until_frontend_is_registered() {
        let mut state = OpenFileState {
            pending: None,
            frontend_ready: false,
        };

        assert_eq!(state.receive("cold-start.md".into()), None);
        assert_eq!(state.register_frontend().as_deref(), Some("cold-start.md"));
    }

    #[test]
    fn open_file_is_dispatched_after_frontend_is_registered() {
        let mut state = OpenFileState {
            pending: None,
            frontend_ready: false,
        };

        assert_eq!(state.register_frontend(), None);
        assert_eq!(
            state.receive("warm-open.md".into()).as_deref(),
            Some("warm-open.md")
        );
    }

    #[test]
    fn decodes_bom_marked_utf8_and_utf16_documents() {
        let utf8 = decode_text_bytes(b"\xEF\xBB\xBF# title").unwrap();
        assert_eq!(utf8.content, "# title");
        assert_eq!(utf8.encoding.name, "UTF-8");
        assert!(utf8.encoding.bom);

        let mut utf16le = vec![0xFF, 0xFE];
        utf16le.extend("# 中文".encode_utf16().flat_map(u16::to_le_bytes));
        let decoded = decode_text_bytes(&utf16le).unwrap();
        assert_eq!(decoded.content, "# 中文");
        assert_eq!(decoded.encoding.name, "UTF-16LE");
        assert!(decoded.encoding.bom);
        assert_eq!(
            encode_text_content(&decoded.content, &decoded.encoding).unwrap(),
            utf16le
        );
    }

    #[test]
    fn detects_and_preserves_legacy_chinese_encoding() {
        let (encoded, _, had_errors) = encoding_rs::GBK.encode("# 中文标题\n正文");
        assert!(!had_errors);
        let decoded = decode_text_bytes(&encoded).unwrap();

        assert_eq!(decoded.content, "# 中文标题\n正文");
        assert_eq!(decoded.encoding.name, "GBK");
        assert!(!decoded.encoding.bom);
        assert_eq!(
            encode_text_content(&decoded.content, &decoded.encoding).unwrap(),
            encoded.into_owned()
        );
    }

    #[test]
    fn rejects_characters_that_the_original_encoding_cannot_store() {
        let encoding = TextEncoding {
            name: "GBK".into(),
            bom: false,
        };
        assert_eq!(
            encode_text_content("emoji 😀", &encoding).unwrap_err(),
            "text_encoding_unrepresentable"
        );
    }

    #[test]
    fn rejects_names_that_can_escape_or_break_cross_platform_workspaces() {
        for name in [
            "../outside.md",
            "folder/note.md",
            "folder\\note.md",
            ".",
            "..",
            "CON.txt",
            "LPT1",
            "trailing.",
        ] {
            assert!(!is_valid_entry_name(name), "accepted unsafe name: {name}");
        }
        assert!(is_valid_entry_name("会议记录 2026.md"));
    }

    #[test]
    fn safe_regex_search_handles_pathological_patterns_and_utf16_offsets() {
        let pathological = format!("{}!", "a".repeat(100_000));
        assert!(
            search_regex("note.md".into(), pathological, "(a+)+$".into(), false,)
                .unwrap()
                .is_empty()
        );

        let matches = search_regex("emoji.md".into(), "a😀b".into(), "😀".into(), false).unwrap();
        let content_match = matches
            .iter()
            .find(|found| found.line_text == "a😀b")
            .unwrap();
        assert_eq!((content_match.match_start, content_match.match_end), (1, 3));
    }

    #[test]
    fn failed_overwrite_copy_keeps_the_existing_destination() {
        let dir = test_directory("copy");
        std::fs::create_dir_all(&dir).unwrap();
        let destination = dir.join("note.md");
        std::fs::write(&destination, "original").unwrap();

        assert!(copy_file_with_overwrite(&dir.join("missing.md"), &destination).is_err());
        assert_eq!(std::fs::read_to_string(&destination).unwrap(), "original");

        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn temporary_siblings_are_unique_and_only_created_by_the_current_process() {
        let dir = test_directory("temporary");
        std::fs::create_dir_all(&dir).unwrap();
        let target = dir.join("note.md");
        let (first_path, first_file) = create_temporary_sibling(&target).unwrap();
        let (second_path, second_file) = create_temporary_sibling(&target).unwrap();

        assert_ne!(first_path, second_path);
        assert!(first_path.exists());
        assert!(second_path.exists());

        drop(first_file);
        drop(second_file);
        std::fs::remove_dir_all(dir).unwrap();
    }

    #[test]
    fn binary_attachments_never_overwrite_an_existing_file() {
        let dir = test_directory("binary");
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("image.png");
        std::fs::write(&path, [1, 2, 3]).unwrap();

        assert_eq!(
            write_binary(path.to_string_lossy().into_owned(), vec![9, 9]).unwrap_err(),
            "file_exists"
        );
        assert_eq!(std::fs::read(&path).unwrap(), vec![1, 2, 3]);

        std::fs::remove_dir_all(dir).unwrap();
    }
}
