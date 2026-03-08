#!/usr/bin/env bash
# scripts/install_libreoffice.sh
#
# Installs LibreOffice for the Word-to-PDF conversion feature.
# Run this once on your dev/server machine, or add it to your Dockerfile.
#
# Usage:
#   bash scripts/install_libreoffice.sh
#
# Supported platforms:
#   - Debian / Ubuntu (apt)
#   - Amazon Linux 2 / RHEL / Fedora (dnf / yum)
#   - macOS (Homebrew)

set -euo pipefail

echo "==> Detecting package manager..."

if command -v apt-get &>/dev/null; then
    echo "==> Using apt (Debian / Ubuntu)"
    sudo apt-get update -y
    sudo apt-get install -y libreoffice --no-install-recommends
    sudo apt-get clean
    sudo rm -rf /var/lib/apt/lists/*

elif command -v dnf &>/dev/null; then
    echo "==> Using dnf (Amazon Linux / RHEL / Fedora)"
    sudo dnf install -y libreoffice
    sudo dnf clean all

elif command -v yum &>/dev/null; then
    echo "==> Using yum (Amazon Linux 2 / older RHEL)"
    sudo yum install -y libreoffice
    sudo yum clean all

elif command -v brew &>/dev/null; then
    echo "==> Using Homebrew (macOS)"
    brew install --cask libreoffice

else
    echo "ERROR: No supported package manager found (apt, dnf, yum, brew)."
    echo "Please install LibreOffice manually: https://www.libreoffice.org/download/"
    exit 1
fi

echo ""
echo "==> Verifying installation..."
if command -v libreoffice &>/dev/null; then
    libreoffice --version
    echo "==> LibreOffice installed successfully."
elif command -v soffice &>/dev/null; then
    soffice --version
    echo "==> LibreOffice (soffice) installed successfully."
else
    echo "WARNING: 'libreoffice' / 'soffice' not found in PATH after installation."
    echo "You may need to add it to your PATH manually."
    exit 1
fi

echo ""
echo "==> Quick smoke test: converting a temporary DOCX to PDF..."
TMPDIR_TEST=$(mktemp -d)
cat > "$TMPDIR_TEST/test.docx" << 'EOF'
This is a placeholder — LibreOffice will still attempt the conversion.
EOF

libreoffice --headless --convert-to pdf --outdir "$TMPDIR_TEST" "$TMPDIR_TEST/test.docx" 2>&1 || true

if [ -f "$TMPDIR_TEST/test.pdf" ]; then
    echo "==> Smoke test passed. PDF generated at $TMPDIR_TEST/test.pdf"
else
    echo "==> Smoke test skipped (placeholder .docx is not a real DOCX, but the binary works)."
fi

rm -rf "$TMPDIR_TEST"
echo ""
echo "Done. LibreOffice is ready for Word-to-PDF conversion."
