import hashlib
import io
from pathlib import Path
import tarfile
import tempfile
import unittest

import release_mirror as mirror


class MirrorTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.addCleanup(self.temp.cleanup)

    def fixture(self, tag):
        stage = Path(tempfile.mkdtemp(dir=self.root))
        for name in mirror.PACKAGES:
            (stage / name).write_bytes(b"fixture package")
        for name in mirror.SIGNED:
            (stage / (name + ".sig")).write_text("fixture signature\n")
        manifest = {"version": tag[1:], "platforms": {
            platform: {"url": f"https://github.com/{mirror.REPOSITORY}/releases/download/{tag}/{name}",
                       "signature": "fixture signature"}
            for platform, name in mirror.UPDATERS.items()
        }}
        mirror.write_json(stage / "latest.json", manifest)
        assets = [{"name": name, "state": "uploaded", "size": (stage / name).stat().st_size,
                   "digest": "sha256:" + hashlib.sha256((stage / name).read_bytes()).hexdigest(),
                   "browser_download_url": f"https://github.com/{mirror.REPOSITORY}/releases/download/{tag}/{name}"}
                  for name in mirror.ASSETS]
        mirror.write_json(stage / "github-release.json", {"tag_name": tag, "assets": assets})
        return stage

    def test_atomic_switch_rewrites_urls_and_removes_old_packages(self):
        mirror.publish(self.root, self.fixture("v1.0.0"))
        mirror.publish(self.root, self.fixture("v1.0.1"))
        current = self.root / "public/latest"
        self.assertEqual(current.resolve().name, "v1.0.1")
        self.assertEqual([p.name for p in (self.root / "public/releases").iterdir()], ["v1.0.1"])
        manifest = mirror.read_json(current / "latest.json")
        for platform, name in mirror.UPDATERS.items():
            self.assertEqual(manifest["platforms"][platform]["url"], f"{mirror.BASE_URL}/releases/v1.0.1/{name}")
            self.assertEqual(manifest["platforms"][platform]["signature"], "fixture signature")
        for asset in mirror.read_json(current / "release.json")["assets"]:
            self.assertTrue(asset["browser_download_url"].startswith(mirror.BASE_URL))

    def test_corrupt_or_incomplete_release_does_not_replace_current(self):
        mirror.publish(self.root, self.fixture("v1.0.0"))
        for corruption in ("missing", "size", "digest", "signature", "version"):
            with self.subTest(corruption=corruption):
                stage = self.fixture("v1.0.1")
                name = mirror.UPDATERS["windows-x86_64"]
                if corruption == "missing":
                    (stage / name).unlink()
                elif corruption in ("size", "digest"):
                    (stage / name).write_bytes(b"wrong" if corruption == "size" else b"corrupt package")
                else:
                    manifest = mirror.read_json(stage / "latest.json")
                    if corruption == "version":
                        manifest["version"] = "9.0.0"
                    else:
                        manifest["platforms"]["windows-x86_64"]["signature"] = "wrong"
                    mirror.write_json(stage / "latest.json", manifest)
                    release = mirror.read_json(stage / "github-release.json")
                    data = (stage / "latest.json").read_bytes()
                    entry = next(a for a in release["assets"] if a["name"] == "latest.json")
                    entry.update(size=len(data), digest="sha256:" + hashlib.sha256(data).hexdigest())
                    mirror.write_json(stage / "github-release.json", release)
                with self.assertRaises((ValueError, FileNotFoundError)):
                    mirror.publish(self.root, stage)
                self.assertEqual((self.root / "public/latest").resolve().name, "v1.0.0")

    def test_late_job_cannot_downgrade_or_replace_same_version(self):
        mirror.publish(self.root, self.fixture("v1.0.1"))
        # Recover cleanup if a previous process stopped just after switching latest.
        (self.root / "public/releases/v0.9.0").mkdir()
        mirror.publish(self.root, self.fixture("v1.0.0"))
        mirror.publish(self.root, self.fixture("v1.0.1"))
        self.assertEqual((self.root / "public/latest").resolve().name, "v1.0.1")
        self.assertEqual(len(list((self.root / "public/releases").iterdir())), 1)

    def test_receive_rejects_paths_symlinks_and_incomplete_archives(self):
        for name, kind in [("../escape", tarfile.REGTYPE), ("latest.json", tarfile.SYMTYPE), ("latest.json", tarfile.REGTYPE)]:
            with self.subTest(name=name, kind=kind):
                stream = io.BytesIO()
                with tarfile.open(fileobj=stream, mode="w") as archive:
                    entry = tarfile.TarInfo(name)
                    entry.type = kind
                    entry.size = 1 if kind == tarfile.REGTYPE else 0
                    entry.linkname = "/etc/passwd" if kind == tarfile.SYMTYPE else ""
                    archive.addfile(entry, io.BytesIO(b"x") if entry.size else None)
                stream.seek(0)
                with tempfile.TemporaryDirectory(dir=self.root) as directory:
                    with self.assertRaises(ValueError):
                        mirror.receive(stream, Path(directory))

    def test_receive_valid_archive_and_validate_it(self):
        stage = self.fixture("v1.0.0")
        stream = io.BytesIO()
        with tarfile.open(fileobj=stream, mode="w") as archive:
            for name in mirror.INPUTS:
                archive.add(stage / name, arcname=name)
        stream.seek(0)
        with tempfile.TemporaryDirectory(dir=self.root) as directory:
            mirror.receive(stream, Path(directory))
            self.assertEqual(mirror.validate(Path(directory))[0]["tag_name"], "v1.0.0")


if __name__ == "__main__":
    unittest.main()
