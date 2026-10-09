#!/bin/sh
set -eu
case "$(uname -s)" in
  Darwin|Linux) ;;
  *) printf '%s\n' 'This installer supports macOS and Linux. Use install.ps1 on Windows.' >&2; exit 1 ;;
esac
command -v curl >/dev/null || { printf '%s\n' 'Install curl and try again.' >&2; exit 1; }
BeeRoot="$HOME/.local/share/BeeBright"
BeeBin="$HOME/.local/bin"
mkdir -p "$BeeRoot/tools" "$BeeBin"
export UV_PYTHON_INSTALL_DIR="$BeeRoot/runtime-3.14"
export UV_PYTHON_BIN_DIR="$BeeRoot/tools"
export UV_NO_MODIFY_PATH=1
if [ ! -x "$BeeRoot/tools/uv" ]; then
  curl -fsSL https://astral.sh/uv/install.sh -o "$BeeRoot/uv-install.sh"
  UV_UNMANAGED_INSTALL="$BeeRoot/tools" sh "$BeeRoot/uv-install.sh"
  rm -f "$BeeRoot/uv-install.sh"
fi
"$BeeRoot/tools/uv" python install 3.14
BeePython=$("$BeeRoot/tools/uv" python find --managed-python 3.14)
"$BeePython" -c 'import sys; assert sys.version_info[:2] == (3,14)'
curl -fsSL https://beebright.vercel.app/local/bootstrap.py -o "$BeeRoot/bootstrap.py.new" || curl -fsSL https://raw.githubusercontent.com/Dev-v1/beebright-local/main/bootstrap.py -o "$BeeRoot/bootstrap.py.new"
mv "$BeeRoot/bootstrap.py.new" "$BeeRoot/bootstrap.py"
# Python writes the shell launcher using shell quoting for paths with spaces.
"$BeePython" - "$BeePython" "$BeeRoot" "$BeeBin" <<'PY'
import pathlib, shlex, sys
python, root, folder = sys.argv[1:]
launcher = pathlib.Path(folder) / 'beebright'
launcher.write_text('#!/bin/sh\nexec ' + shlex.quote(python) + ' ' + shlex.quote(root + '/bootstrap.py') + ' "$@"\n')
launcher.chmod(0o755)
PY
"$BeeBin/beebright" update
case "${SHELL:-}" in
  */zsh) BeeProfile="$HOME/.zshrc" ;;
  *) BeeProfile="$HOME/.bashrc" ;;
esac
BeePathLine='export PATH="$HOME/.local/bin:$PATH" # BeeBright'
if ! grep -F "$BeePathLine" "$BeeProfile" >/dev/null 2>&1; then
  printf '\n%s\n' "$BeePathLine" >> "$BeeProfile"
fi
printf '%s\n' 'Installed BeeBright with its own Python 3.14 runtime.' 'Open a new terminal, then type beebright. Or run ~/.local/bin/beebright now.' 'macOS/Linux practice opens the same offline UI in your browser. Keep the terminal open; Ctrl+C stops it.'
