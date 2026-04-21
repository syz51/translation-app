use std::env;
use std::ffi::OsString;
use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

fn main() {
    println!("cargo:rerun-if-env-changed=PATH");
    println!("cargo:rerun-if-changed=binaries");

    ensure_sidecar("ffmpeg");
    ensure_sidecar("ffprobe");

    tauri_build::build()
}

fn ensure_sidecar(binary_name: &str) {
    let target = env::var("TARGET").expect("TARGET is not set");
    let manifest_dir =
        PathBuf::from(env::var("CARGO_MANIFEST_DIR").expect("CARGO_MANIFEST_DIR is not set"));
    let binaries_dir = manifest_dir.join("binaries");
    let target_binary = binaries_dir.join(format!("{binary_name}-{target}"));

    fs::create_dir_all(&binaries_dir).expect("failed to create binaries directory");

    let source_binary = find_on_path(binary_name);
    if should_copy_sidecar_from_source(&target_binary, source_binary.as_deref()) {
        let source_binary = source_binary.unwrap_or_else(|| {
            panic!(
                "Missing usable sidecar `{}` and could not find `{}` on PATH. Install it locally or add `{}` manually.",
                target_binary.display(),
                binary_name,
                target_binary.display()
            )
        });
        replace_file(&source_binary, &target_binary);
    }

    ensure_user_writable(&target_binary);

    #[cfg(target_os = "macos")]
    prepare_macos_sidecar_bundle(&target_binary, &binaries_dir);
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

fn replace_file(source: &Path, destination: &Path) {
    if destination.exists() {
        ensure_user_writable(destination);
        fs::remove_file(destination).unwrap_or_else(|error| {
            panic!(
                "Failed to remove `{}` before replacing it: {}",
                destination.display(),
                error
            )
        });
    }

    fs::copy(source, destination).unwrap_or_else(|error| {
        panic!(
            "Failed to copy `{}` to `{}`: {}",
            source.display(),
            destination.display(),
            error
        )
    });

    ensure_user_writable(destination);
}

#[cfg(unix)]
fn ensure_user_writable(path: &Path) {
    use std::os::unix::fs::PermissionsExt;

    let metadata = fs::metadata(path).unwrap_or_else(|error| {
        panic!("Failed to read metadata for `{}`: {}", path.display(), error)
    });
    let mut permissions = metadata.permissions();
    permissions.set_mode(permissions.mode() | 0o200);
    fs::set_permissions(path, permissions).unwrap_or_else(|error| {
        panic!("Failed to update permissions for `{}`: {}", path.display(), error)
    });
}

#[cfg(not(unix))]
fn ensure_user_writable(path: &Path) {
    let metadata = fs::metadata(path).unwrap_or_else(|error| {
        panic!("Failed to read metadata for `{}`: {}", path.display(), error)
    });
    let mut permissions = metadata.permissions();
    permissions.set_readonly(false);
    fs::set_permissions(path, permissions).unwrap_or_else(|error| {
        panic!("Failed to update permissions for `{}`: {}", path.display(), error)
    });
}

#[cfg(not(target_os = "macos"))]
fn should_refresh_sidecar(_path: &Path) -> bool {
    false
}

#[cfg(target_os = "macos")]
fn should_refresh_sidecar(path: &Path) -> bool {
    if !path.exists() {
        return true;
    }

    let dependencies = list_macos_dependencies(path);
    dependencies.iter().any(|dependency| !dependency.exists())
}

#[cfg(target_os = "macos")]
fn should_copy_sidecar_from_source(path: &Path, source_path: Option<&Path>) -> bool {
    if !path.exists() {
        return true;
    }

    if should_refresh_sidecar(path) {
        return true;
    }

    // A previously rewritten cached sidecar no longer contains the original
    // absolute dependency paths, so rebuild it from PATH before bundling.
    source_path.is_some() && list_macos_dependencies(path).is_empty()
}

#[cfg(not(target_os = "macos"))]
fn should_copy_sidecar_from_source(path: &Path, _source_path: Option<&Path>) -> bool {
    !path.exists() || should_refresh_sidecar(path)
}

#[cfg(target_os = "macos")]
fn prepare_macos_sidecar_bundle(binary_path: &Path, binaries_dir: &Path) {
    let lib_dir = binaries_dir.join("lib");
    fs::create_dir_all(&lib_dir).expect("failed to create bundled library directory");

    let mut queue = list_macos_dependencies(binary_path);
    let mut bundled = Vec::<(PathBuf, PathBuf)>::new();

    while let Some(source_path) = queue.pop() {
        let file_name = source_path
            .file_name()
            .unwrap_or_else(|| panic!("dependency missing filename: {}", source_path.display()));
        let bundled_path = lib_dir.join(file_name);

        if bundled.iter().any(|(existing, _)| existing == &source_path) {
            continue;
        }

        replace_file(&source_path, &bundled_path);

        bundled.push((source_path.clone(), bundled_path.clone()));

        for nested_dependency in list_macos_dependencies(&source_path) {
            if !bundled
                .iter()
                .any(|(existing, _)| existing == &nested_dependency)
                && !queue.iter().any(|existing| existing == &nested_dependency)
            {
                queue.push(nested_dependency);
            }
        }
    }

    for (_, bundled_path) in &bundled {
        let bundled_name = bundled_path.file_name().unwrap().to_string_lossy().into_owned();
        run_command(
            Command::new("install_name_tool")
                .arg("-id")
                .arg(bundled_install_name(&bundled_name))
                .arg(bundled_path),
            "failed to rewrite dylib install name",
        );
    }

    rewrite_macos_dependency_paths(binary_path, &bundled);
    for (_, bundled_path) in &bundled {
        rewrite_macos_dependency_paths(bundled_path, &bundled);
    }

    for (_, bundled_path) in &bundled {
        codesign_macos_binary(bundled_path);
    }
    codesign_macos_binary(binary_path);
}

#[cfg(target_os = "macos")]
fn rewrite_macos_dependency_paths(target_path: &Path, bundled: &[(PathBuf, PathBuf)]) {
    for (source_path, bundled_path) in bundled {
        // `install_name_tool -id` already rewrites a dylib's own install name.
        // Trying to `-change` the same dylib inside itself is unnecessary and
        // can fail on some Homebrew-built libraries.
        if target_path == bundled_path {
            continue;
        }

        let bundled_name = bundled_path.file_name().unwrap().to_string_lossy().into_owned();
        let target_name = bundled_install_name(&bundled_name);

        run_command(
            Command::new("install_name_tool")
                .arg("-change")
                .arg(source_path)
                .arg(&target_name)
                .arg(target_path),
            &format!(
                "failed to rewrite dependency `{}` in `{}`",
                source_path.display(),
                target_path.display()
            ),
        );
    }
}

#[cfg(target_os = "macos")]
fn bundled_install_name(file_name: &str) -> String {
    format!("@executable_path/../Resources/binaries/lib/{file_name}")
}

#[cfg(target_os = "macos")]
fn list_macos_dependencies(binary_path: &Path) -> Vec<PathBuf> {
    let output = Command::new("otool")
        .arg("-L")
        .arg(binary_path)
        .output()
        .unwrap_or_else(|error| {
            panic!(
                "failed to inspect `{}` with otool: {}",
                binary_path.display(),
                error
            )
        });

    if !output.status.success() {
        panic!(
            "otool -L failed for `{}`: {}",
            binary_path.display(),
            String::from_utf8_lossy(&output.stderr)
        );
    }

    String::from_utf8_lossy(&output.stdout)
        .lines()
        .skip(1)
        .filter_map(|line| line.split_whitespace().next())
        .filter(|path| should_bundle_macos_dependency(path))
        .map(PathBuf::from)
        .collect()
}

#[cfg(target_os = "macos")]
fn should_bundle_macos_dependency(path: &str) -> bool {
    path.starts_with('/')
        && !path.starts_with("/System/Library/")
        && !path.starts_with("/usr/lib/")
}

#[cfg(target_os = "macos")]
fn run_command(command: &mut Command, context: &str) {
    let output = command.output().unwrap_or_else(|error| {
        panic!("{}: {}", context, error);
    });

    if !output.status.success() {
        panic!(
            "{}: {}",
            context,
            String::from_utf8_lossy(&output.stderr)
        );
    }
}

#[cfg(target_os = "macos")]
fn codesign_macos_binary(path: &Path) {
    let _ = Command::new("codesign")
        .arg("--remove-signature")
        .arg(path)
        .output();

    run_command(
        Command::new("codesign")
            .arg("--force")
            .arg("--sign")
            .arg("-")
            .arg("--timestamp=none")
            .arg(path),
        &format!("failed to codesign `{}`", path.display()),
    );
}
