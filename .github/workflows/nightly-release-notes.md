Automatic builds of the latest commit on `main`. **Not a stable release** — these are replaced
every time `main` moves, and nothing here has been through review, QA or a store.

| Download | Platform | Notes |
|---|---|---|
| `lmthing-linux-x86_64.AppImage` | Linux x86_64 | `chmod +x` it and run it |
| `lmthing-linux-amd64.deb` | Debian / Ubuntu | `sudo apt install ./lmthing-linux-amd64.deb` |
| `lmthing-android-arm64.apk` | Android, arm64 only | Enable "install unknown apps" first |

Each `BUILD-INFO-*.txt` records the exact commit, build time and Actions run that produced the
asset beside it. **The assets are replaced independently**, so the desktop and Android downloads
are not guaranteed to come from the same commit — check the matching `BUILD-INFO` file.

### Read this before installing

- **Everything here is UNSIGNED.** On Linux that costs you nothing. The Android APK is signed with
  the standard Android *debug* key, not a release key — which is why it cannot be uploaded to Play,
  and why it will refuse to install over a copy installed from the Play Store.
- **The APK is arm64-v8a only.** That is every Android phone made in roughly the last decade, but
  it will **not** install on the usual x86_64 emulator.
- **The APK cannot receive over-the-air updates.** It is built without an update-server app id, so
  it stays on the exact JavaScript it shipped with. To get updates, use a store or staging build.
- **The Linux builds are made on Ubuntu 22.04.** AppImage and `.deb` are forward-compatible only:
  they run on 22.04 and newer, and fail on older distros with `version 'GLIBC_2.x' not found`.

macOS and Windows are not built per commit — they are produced by the `Desktop release` workflow
from a `desktop-v*` tag.
