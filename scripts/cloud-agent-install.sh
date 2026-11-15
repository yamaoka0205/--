#!/usr/bin/env bash
# Cloud Agent install: Python deps for DynamoDB / AWS CLI work.
set -euo pipefail

python3 -m pip install --user -r requirements.txt 'awscli>=1.32'

# Ensure user-local bin is available in non-interactive shells used by agents.
mkdir -p "$HOME/.local/bin"
if ! grep -q 'CURSOR_AWS_PATH' "$HOME/.bashrc" 2>/dev/null; then
  printf '\n# CURSOR_AWS_PATH\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.bashrc"
fi
if ! grep -q 'CURSOR_AWS_PATH' "$HOME/.profile" 2>/dev/null; then
  printf '\n# CURSOR_AWS_PATH\nexport PATH="$HOME/.local/bin:$PATH"\n' >> "$HOME/.profile"
fi

# Symlink into /usr/local/bin when permitted so login shells find aws without rc files.
if command -v sudo >/dev/null 2>&1; then
  sudo ln -sf "$HOME/.local/bin/aws" /usr/local/bin/aws || true
fi

python3 -c "import boto3; print('boto3', boto3.__version__)"
"$HOME/.local/bin/aws" --version
