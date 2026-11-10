#!/usr/bin/env python3
"""Publish a complete signed GitHub release through the InkNote download mirror."""
import argparse
import contextlib
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import sys
import tarfile
import tempfile
import urllib.request

REPOSITORY = "likehao19/InkNote"
BASE_URL = "https://inknote.likh.cn/downloads"
UPDATERS = {
    "windows-x86_64": "InkNote-Windows-x64-Setup.exe",
    "darwin-x86_64": "InkNote-macOS-x86_64.app.tar.gz",
    "darwin-aarch64": "InkNote-macOS-arm64.app.tar.gz",
    "linux-x86_64": "InkNote-Linux-x86_64.AppImage",
    "linux-aarch64": "InkNote-Linux-arm64.AppImage",
}
PACKAGES = set(UPDATERS.values()) | {
    "InkNote-macOS-arm64.dmg", "InkNote-macOS-x86_64.dmg",
    "InkNote-Linux-arm64.deb", "InkNote-Linux-arm64.rpm",
    "InkNote-Linux-x86_64.deb", "InkNote-Linux-x86_64.rpm",
}
SIGNED = set(UPDATERS.values()) | {name for name in PACKAGES if name.endswith((".deb", ".rpm"))}
ASSETS = PACKAGES | {name + ".sig" for name in SIGNED} | {"latest.json"}
INPUTS = ASSETS | {"github-release.json"}


def version(tag):
    if not re.fullmatch(r"v\d+\.\d+\.\d+", tag):
        raise ValueError("Only stable vMAJOR.MINOR.PATCH releases are accepted")
    return tuple(map(int, tag[1:].split(".")))


def read_json(path):
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path, value):
    path.write_text(json.dumps(value, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


def asset_map(release):
    tag = release["tag_name"]
    version(tag)
    if release.get("draft") or release.get("prerelease"):
        raise ValueError("Draft/prerelease cannot be mirrored")
    assets = {asset["name"]: asset for asset in release["assets"]}
    for name in ASSETS:
        asset = assets[name]  # Missing platforms/manifest must not replace the live version.
        if asset.get("state") != "uploaded" or not 0 < asset["size"] <= 2 * 1024**3:
            raise ValueError("Invalid asset: " + name)
        if not re.fullmatch(r"sha256:[0-9a-f]{64}", asset.get("digest", "")):
            raise ValueError("Missing SHA-256: " + name)
        expected = f"https://github.com/{REPOSITORY}/releases/download/{tag}/{name}"
        if asset["browser_download_url"] != expected:
            raise ValueError("Unexpected asset URL: " + name)
    return {name: assets[name] for name in ASSETS}


def fetch_release(tag):
    if tag != "latest":
        version(tag)
    suffix = "latest" if tag == "latest" else "tags/" + tag
    request = urllib.request.Request(f"https://api.github.com/repos/{REPOSITORY}/releases/{suffix}",
                                     headers={"User-Agent": "InkNote-release-mirror", "Accept": "application/vnd.github+json"})
    token = os.environ.get("GH_TOKEN")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    with urllib.request.urlopen(request, timeout=60) as response:
        release = json.load(response)
    asset_map(release)
    return release


def download(release, destination):
    for name, asset in sorted(asset_map(release).items()):
        request = urllib.request.Request(asset["browser_download_url"], headers={"User-Agent": "InkNote-release-mirror"})
        with urllib.request.urlopen(request, timeout=120) as response, (destination / name).open("wb") as output:
            shutil.copyfileobj(response, output, 1024 * 1024)
        print("Downloaded " + name, flush=True)
    write_json(destination / "github-release.json", release)
    validate(destination)


def validate(directory):
    release = read_json(directory / "github-release.json")
    for name, asset in asset_map(release).items():
        path = directory / name
        if path.is_symlink() or not path.is_file() or path.stat().st_size != asset["size"]:
            raise ValueError("Wrong size/type: " + name)
        digest = hashlib.sha256()
        with path.open("rb") as source:
            for block in iter(lambda: source.read(1024 * 1024), b""):
                digest.update(block)
        if "sha256:" + digest.hexdigest() != asset["digest"]:
            raise ValueError("SHA-256 mismatch: " + name)
    manifest = read_json(directory / "latest.json")
    if manifest["version"].lstrip("v") != release["tag_name"][1:]:
        raise ValueError("Manifest version mismatch")
    if set(manifest["platforms"]) != set(UPDATERS):
        raise ValueError("Incomplete updater platforms")
    for platform, name in UPDATERS.items():
        entry = manifest["platforms"][platform]
        if entry["url"] != asset_map(release)[name]["browser_download_url"]:
            raise ValueError("Updater URL mismatch")
        if entry["signature"].strip() != (directory / (name + ".sig")).read_text().strip():
            raise ValueError("Updater signature mismatch")
    return release, manifest


def receive(stream, directory):
    """Accept only flat regular files; never extract paths, symlinks or devices."""
    seen = set()
    with tarfile.open(fileobj=stream, mode="r|") as archive:
        for member in archive:
            if member.name not in INPUTS or member.name in seen or not member.isfile():
                raise ValueError("Unexpected archive member: " + member.name)
            limit = 2 * 1024**3 if member.name in PACKAGES else 2 * 1024**2
            if not 0 < member.size <= limit:
                raise ValueError("Archive member too large")
            seen.add(member.name)
            with archive.extractfile(member) as source, (directory / member.name).open("xb") as output:
                shutil.copyfileobj(source, output, 1024 * 1024)
    if seen != INPUTS:
        raise ValueError("Incomplete upload")


def prune(root):
    current = root / "public/latest"
    if not current.exists():
        return
    target = current.resolve()
    for old in (root / "public/releases").iterdir():
        if old.resolve() != target and old.is_dir() and re.fullmatch(r"v\d+\.\d+\.\d+", old.name):
            shutil.rmtree(old)


def publish(root, stage):
    release, manifest = validate(stage)
    tag = release["tag_name"]
    public = root / "public"
    releases = public / "releases"
    releases.mkdir(parents=True, exist_ok=True)
    current = public / "latest"
    if current.exists():
        installed = read_json(current / "release.json")["tag_name"]
        if version(tag) <= version(installed):
            prune(root)
            print("Already serving " + installed + "; ignoring " + tag, flush=True)
            return
    for platform, name in UPDATERS.items():
        manifest["platforms"][platform]["url"] = f"{BASE_URL}/releases/{tag}/{name}"
    write_json(stage / "latest.json", manifest)
    write_json(stage / "release.json", {
        "tag_name": tag, "body": release.get("body", ""),
        "published_at": release.get("published_at"),
        "assets": [{"name": name, "browser_download_url": f"{BASE_URL}/releases/{tag}/{name}"}
                   for name in sorted(PACKAGES)],
    })
    (stage / "github-release.json").unlink()
    stage.chmod(0o755)
    for path in stage.iterdir():
        path.chmod(0o644)
    target = releases / tag
    # Only remove an unfinished target that is not the active release.
    if target.exists():
        shutil.rmtree(target)
    os.replace(stage, target)
    pending = public / "latest.new"
    pending.unlink(missing_ok=True)
    pending.symlink_to("releases/" + tag)
    os.replace(pending, current)
    prune(root)
    print("Published " + tag + "; only the latest release is retained", flush=True)


@contextlib.contextmanager
def locked(root):
    import fcntl  # Server is Linux; prepare can also run on other platforms.
    root.mkdir(parents=True, exist_ok=True)
    with (root / "sync.lock").open("a") as lock:
        fcntl.flock(lock, fcntl.LOCK_EX)
        yield


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("command", choices=["prepare", "receive", "sync"])
    parser.add_argument("--tag", default="latest")
    parser.add_argument("--output", type=Path)
    parser.add_argument("--root", type=Path, default=Path("/srv/inknote-downloads"))
    args = parser.parse_args()
    os.umask(0o022)
    if args.command == "prepare":
        args.output.mkdir(parents=True, exist_ok=False)
        download(fetch_release(args.tag), args.output)
        return
    with locked(args.root):
        prune(args.root)
        staging = args.root / "staging"
        staging.mkdir(exist_ok=True, mode=0o700)
        for stale in staging.glob("upload-*"):
            if stale.is_dir() and not stale.is_symlink():
                shutil.rmtree(stale)
        release = fetch_release(args.tag) if args.command == "sync" else None
        current = args.root / "public/latest/release.json"
        if release and current.exists() and version(release["tag_name"]) <= version(read_json(current)["tag_name"]):
            print("Mirror is current", flush=True)
            return
        with tempfile.TemporaryDirectory(prefix="upload-", dir=staging) as directory:
            stage = Path(directory)
            if release:
                download(release, stage)
            else:
                receive(sys.stdin.buffer, stage)
            publish(args.root, stage)


if __name__ == "__main__":
    main()
