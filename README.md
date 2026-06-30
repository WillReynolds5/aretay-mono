# Aretay Mono

Umbrella repo for the iOS app and the unified web/admin + Supabase workspace.

```
aretay-mono/
├── aretay-ios/        → github.com/WillReynolds5/aretay-ios
└── aretay-web/        → Next admin, marketing pages, Supabase migrations/functions
```

## Clone

```bash
git clone --recurse-submodules https://github.com/WillReynolds5/aretay-mono.git
```

If you already cloned without `--recurse-submodules`:

```bash
git submodule update --init --recursive
```

## Working with the iOS submodule

`aretay-ios` is still its own independent git repo. The mono repo stores a
pointer to a specific iOS commit.

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

### Pull the latest iOS submodule

```bash
git submodule update --remote --merge
```

## Backend stack

Supabase migrations and Edge Functions live in `aretay-web/supabase/`.
Use `aretay-web/run-backend.sh` directly, or root `./run.sh` for the local
admin + Supabase dev stack.
