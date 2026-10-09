#!/bin/sh
set -eu
BeeTestRoot="$RUNNER_TEMP/beebright-python315"
mkdir -p "$BeeTestRoot/tools"
curl -fsSL https://astral.sh/uv/install.sh -o "$BeeTestRoot/uv-install.sh"
UV_UNMANAGED_INSTALL="$BeeTestRoot/tools" sh "$BeeTestRoot/uv-install.sh"
export UV_PYTHON_INSTALL_DIR="$BeeTestRoot/runtime-3.15"
export UV_PYTHON_BIN_DIR="$BeeTestRoot/tools"
export UV_NO_MODIFY_PATH=1
"$BeeTestRoot/tools/uv" python install 3.15
BeeTestPython=$("$BeeTestRoot/tools/uv" python find --managed-python 3.15)
"$BeeTestPython" -c 'import sys; assert sys.version_info[:2] == (3,15)'
"$BeeTestPython" -m unittest discover -s local -v
