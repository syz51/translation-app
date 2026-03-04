use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};

fn main() {
    println!("cargo:rerun-if-env-changed=PATH");
    println!("cargo:rerun-if-changed=binaries");

    ensure_sidecar("ffmpeg");
    ensure_sidecar("ffprobe");

    tauri_build::build()
}

fn ensure_sidecar(binary_name: &str) {
    let target = env::var("TARGET").expect("TARGET is not set");
    let manifest_dir = PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set"));
    let binaries_dir = manifest_dir.join("binaries");
    let target_binary = binaries_dir.join(format!("{binary_name}-{target}"));

    if target_binary.exists() {
        return;
    }

    let source_binary = find_on_path(binary_name).unwrap_or_else(|| {
        panic!(
            "Missing sidecar `{}` and could not find `{}` on PATH. Install it locally or add `{}` manually.",
            target_binary.display(),
            binary_name,
            target_binary.display()
        )
    });

    fs::create_dir_all(&binaries_dir).expect("failed to create binaries directory");
    fs::copy(&source_binary, &target_binary).unwrap_or_else(|error| {
        panic!(
            "Failed to copy `{}` to `{}`: {}",
            source_binary.display(),
            target_binary.display(),
            error
        )
    });
}

fn find_on_path(binary_name: &str) -> Option<PathBuf> {
    let path = env::var_os("PATH")?;
    #[cfg(target_os = "windows")]
    let candidates = vec![
        OsString::from(binary_name),
        OsString::from(format!("{binary_name}.exe")),
    ];

    #[cfg(not(target_os = "windows"))]
    let candidates = vec![OsString::from(binary_name)];

    env::split_paths(&path)
        .flat_map(|dir| candidates.iter().map(move |name| dir.join(name)))
        .find(|candidate| is_executable_file(candidate))
}

fn is_executable_file(path: &Path) -> bool {
    path.is_file()
}
