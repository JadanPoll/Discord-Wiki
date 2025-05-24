#!/usr/bin/env bash
#GPT made this fancy. Actually very simple :)
set -euo pipefail

# ─── Colors ───────────────────────────────────────────────────────────────
RED='\033[0;31m';    GREEN='\033[0;32m'
YELLOW='\033[1;33m'; BLUE='\033[1;34m'
NC='\033[0m' # No Color

info()    { echo -e "${BLUE}→${NC} $*"; }
success() { echo -e "${GREEN}✔${NC} $*"; }
warn()    { echo -e "${YELLOW}⚠${NC} $*"; }
fatal()   { echo -e "${RED}✖${NC} $*"; exit 1; }

# ─── Prep: Don’t run as root ───────────────────────────────────────────────
if [ "$EUID" -eq 0 ]; then
  warn "Running as root is not recommended. You may encounter permission issues later."
fi

# ─── 1. Core APT packages ──────────────────────────────────────────────────
CORE_PKGS=(git python3-pip curl)
info "Updating APT and installing: ${CORE_PKGS[*]}"
sudo apt update
sudo apt install -y "${CORE_PKGS[@]}"
success "Core packages installed."

# ─── 2. Node.js 20.x ──────────────────────────────────────────────────────
REQUIRED_NODE_MAJOR=20
if command -v node &>/dev/null && [[ "$(node -v | cut -d. -f1 | tr -d 'v')" -ge $REQUIRED_NODE_MAJOR ]]; then
  success "Node.js $(node -v) already installed."
else
  info "Setting up Node.js ${REQUIRED_NODE_MAJOR}.x repo…"
  curl -fsSL https://deb.nodesource.com/setup_${REQUIRED_NODE_MAJOR}.x | sudo -E bash -
  info "Installing Node.js…"
  sudo apt install -y nodejs
  success "Node.js $(node -v) installed."
fi

# ─── 3. Yarn ───────────────────────────────────────────────────────────────
if command -v yarn &>/dev/null; then
  success "Yarn $(yarn --version) already installed."
else
  info "Installing Yarn via npm…"
  sudo npm install -g yarn
  success "Yarn $(yarn --version) installed."
fi

# ─── 4. Validate project root ─────────────────────────────────────────────
if [ ! -f package.json ]; then
  fatal "package.json not found. Please run this from your project root."
fi

# ─── 5. Install dependencies ──────────────────────────────────────────────
info "Installing project dependencies…"
yarn install
success "Dependencies installed."

# ─── 6. Ensure concurrently ──────────────────────────────────────────────
if grep -q '"concurrently"' package.json 2>/dev/null; then
  success "concurrently is already listed in package.json."
elif [ -x "./node_modules/.bin/concurrently" ]; then
  success "concurrently binary found in node_modules."
else
  info "Adding concurrently as a dev dependency…"
  yarn add --dev concurrently
  success "concurrently added."
fi

# ─── 7. Launch dev servers ────────────────────────────────────────────────
info "Starting both development servers…"
yarn start-both-dev
