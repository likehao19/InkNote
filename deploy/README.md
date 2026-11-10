# InkNote download mirror (likh)

The existing Baota site `inknote.likh.cn` serves `/downloads/` through the
site extension `downloads.conf`. No additional web process or port is needed.

- Public files: `/srv/inknote-downloads/public/releases/vMAJOR.MINOR.PATCH/`
- Atomic pointer: `/srv/inknote-downloads/public/latest`
- App updater: `https://inknote.likh.cn/downloads/latest/latest.json`
- Website metadata: `https://inknote.likh.cn/downloads/latest/release.json`
- Receiver script: `/opt/inknote-release-mirror/release_mirror.py`
- Upload/service account: `inknote-release` (no sudo, forced SSH command).

The release workflow calls `mirror-release.yml` only after publishing the
complete GitHub updater manifest. It checks all expected files, SHA-256 digests
and correspondence of updater signatures before uploading. The receiver repeats
these checks, rewrites URLs while preserving signatures, then atomically switches
`latest`. The app still verifies the signed installer using its existing public
key. Signing private keys stay in the existing GitHub signing secret.

Only the latest complete stable version is kept on the server. Packages from
older versions are removed after the pointer switches; old versioned links then
return 404. Historical releases remain on GitHub. Partial uploads live outside
the public directory and are removed on failure or the next locked run after an
interruption. Same/older versions never overwrite the active version.

Both push and pull use `/srv/inknote-downloads/sync.lock`. The systemd timer runs
every 30 minutes with up to 30 seconds jitter. Downloads are streamed, and the
fallback service is limited to 256 MB memory and 50% of one CPU. Incomplete GitHub
releases or network failures leave the current version available.

## Operations

```sh
systemctl list-timers inknote-release-sync.timer
systemctl start inknote-release-sync.service
journalctl -u inknote-release-sync.service -n 40
readlink /srv/inknote-downloads/public/latest
```

Manual pipeline retry: run **Mirror release to likh** with `tag=latest` (or a
complete stable tag). GitHub secrets `LIKH_DOWNLOAD_KEY` and
`LIKH_DOWNLOAD_KNOWN_HOSTS` hold a dedicated deploy key and the pinned public host
key. Never use the administrator's SSH key in CI. To rotate the deploy key,
replace the forced-command entry and GitHub secret together. The root-owned
`authorized_keys` allows only the receiver, with forwarding/PTY disabled.

`install-mirror.sh` installs the script, systemd units and the site extension from
a directory containing these deployment files, `release_mirror.py` and a
`mirror-key.pub`. Back up the website and site extension before installing.
After Nginx configuration validation it reloads the existing Nginx and enables
the timer. Website deployment is separate: upload the tracked `website/` files,
preserving `.well-known`, `.user.ini` and unrelated site files.

For an incident, stop the timer and disable the mirror workflow before any
manual rollback. Because old packages are deleted, download the chosen complete
release from GitHub and restore it under operator control, or publish a newer
fixed version. Normal sync intentionally rejects downgrades. The website/config
backup is separate from installer storage; do not back up installer histories.

Clients older than v0.2.18 still have the GitHub updater URL. They must install
v0.2.18 or newer once (via GitHub update or the website), after which version
checks and package downloads use this mirror.

Tests: `python3 -m unittest discover -s scripts -p 'test_release_mirror.py'`.
