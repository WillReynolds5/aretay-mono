# Aretay Mono

Umbrella repo that pins the iOS app and backend at specific commits via git submodules.

```
aretay-mono/
├── aretay-ios/        → github.com/WillReynolds5/aretay-ios
└── aretay-backend/    → github.com/WillReynolds5/aretay-backend
```

## Clone

```bash
git clone --recurse-submodules https://github.com/WillReynolds5/aretay-mono.git
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Working with submodules

Each subfolder is its **own independent git repo** with its own remote. The mono
repo only stores a **pointer to a specific commit** in each submodule — it does
not store the submodule's files directly.

### Make changes inside a submodule

```bash
cd aretay-ios
# edit, commit, push as usual to the aretay-ios remote
git add .
git commit -m "..."
git push
```

### Update the mono to point at the submodule's new commits

```bash
cd ..                                    # back to aretay-mono
git add aretay-ios                       # records the new submodule SHA
git commit -m "Bump aretay-ios to latest"
git push
```

### Pull the latest of all submodules

```bash
git submodule update --remote --merge
```

## Backend stack

Backend is being scaffolded with **Supabase** (see `aretay-backend/supabase/`).
