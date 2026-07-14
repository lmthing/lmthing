#!/usr/bin/env bash
#
# setup-azure-claude.sh
# One-time setup for running Claude Code against Azure OpenAI via a LiteLLM proxy.
#
# This script ONLY sets things up. It creates ~/.claude-azure/ containing:
#   - litellm.config.yaml   the proxy config
#   - env                   the Azure key + settings (sourced by the runner)
#   - serve.sh              starts the LiteLLM proxy
#   - launch.sh            starts the proxy (if needed) then runs Claude Code
#   - venv/                 python venv with litellm[proxy]
# It also writes ~/.claude/settings.azure.json and adds a `claude-az` zsh alias
# that runs launch.sh.
#
# Example:
#   ./setup-azure-claude.sh \
#       --api-key <AZURE_KEY> \
#       --resource my-resource \
#       --main-deployment gpt-5.5 \
#       --fast-deployment gpt-5.4
#
# Afterwards:  source ~/.zshrc && claude-az
#
set -euo pipefail

# --- defaults ---------------------------------------------------------------
AZURE_API_KEY=""
AZURE_RESOURCE=""
AZURE_API_BASE=""            # derived from AZURE_RESOURCE if unset
AZURE_API_VERSION="preview"  # GPT-5 class Azure deployments use the v1 surface
MAIN_DEPLOYMENT=""
FAST_DEPLOYMENT=""
MAIN_MODEL_NAME="claude-sonnet-4-5"
FAST_MODEL_NAME="claude-3-5-haiku"
MAIN_BASE_MODEL="azure/gpt-4o"        # for LiteLLM cost/limit tracking only
FAST_BASE_MODEL="azure/gpt-4o-mini"   # for LiteLLM cost/limit tracking only
PROXY_PORT="4000"
PROXY_MASTER_KEY="sk-local-proxy"
HOME_DIR="$HOME/.claude-azure"
ZSHRC="$HOME/.zshrc"

usage() {
  cat <<EOF
Usage: $0 --api-key KEY --resource NAME --main-deployment NAME --fast-deployment NAME [options]

Required:
  --api-key KEY               Azure OpenAI API key
  --resource NAME             Azure resource name (endpoint becomes
                              https://NAME.openai.azure.com)
  --main-deployment NAME      Azure deployment for the main model
  --fast-deployment NAME      Azure deployment for the small/fast model

Options:
  --api-base URL              Full endpoint URL; overrides --resource
  --api-version VER           Azure API version (default: $AZURE_API_VERSION)
  --main-model NAME           Model name Claude Code requests (default: $MAIN_MODEL_NAME)
  --fast-model NAME           Fast model name (default: $FAST_MODEL_NAME)
  --main-base-model NAME      Known model for cost tracking (default: $MAIN_BASE_MODEL)
  --fast-base-model NAME      Known model for cost tracking (default: $FAST_BASE_MODEL)
  --port PORT                 Proxy port (default: $PROXY_PORT)
  --master-key KEY            Dummy key Claude Code sends (default: $PROXY_MASTER_KEY)
  --dir PATH                  Install dir (default: $HOME_DIR)
  --zshrc FILE                zshrc path (default: $ZSHRC)
  -h, --help                  Show this help
EOF
}

# --- parse args -------------------------------------------------------------
while [[ $# -gt 0 ]]; do
  case "$1" in
    --api-key)          AZURE_API_KEY="$2"; shift 2;;
    --resource)         AZURE_RESOURCE="$2"; shift 2;;
    --api-base)         AZURE_API_BASE="$2"; shift 2;;
    --api-version)      AZURE_API_VERSION="$2"; shift 2;;
    --main-deployment)  MAIN_DEPLOYMENT="$2"; shift 2;;
    --fast-deployment)  FAST_DEPLOYMENT="$2"; shift 2;;
    --main-model)       MAIN_MODEL_NAME="$2"; shift 2;;
    --fast-model)       FAST_MODEL_NAME="$2"; shift 2;;
    --main-base-model)  MAIN_BASE_MODEL="$2"; shift 2;;
    --fast-base-model)  FAST_BASE_MODEL="$2"; shift 2;;
    --port)             PROXY_PORT="$2"; shift 2;;
    --master-key)       PROXY_MASTER_KEY="$2"; shift 2;;
    --dir)              HOME_DIR="$2"; shift 2;;
    --zshrc)            ZSHRC="$2"; shift 2;;
    -h|--help)          usage; exit 0;;
    *) echo "Unknown argument: $1" >&2; usage; exit 1;;
  esac
done

# --- derive / validate ------------------------------------------------------
if [[ -z "$AZURE_API_BASE" && -n "$AZURE_RESOURCE" ]]; then
  AZURE_API_BASE="https://${AZURE_RESOURCE}.openai.azure.com"
fi

missing=()
[[ -z "$AZURE_API_KEY" ]]   && missing+=(--api-key)
[[ -z "$AZURE_API_BASE" ]]  && missing+=("--resource (or --api-base)")
[[ -z "$MAIN_DEPLOYMENT" ]] && missing+=(--main-deployment)
[[ -z "$FAST_DEPLOYMENT" ]] && missing+=(--fast-deployment)
if [[ ${#missing[@]} -gt 0 ]]; then
  echo "ERROR: missing required arguments: ${missing[*]}" >&2
  echo >&2
  usage
  exit 1
fi

VENV_DIR="$HOME_DIR/venv"
CONFIG_FILE="$HOME_DIR/litellm.config.yaml"
ENV_FILE="$HOME_DIR/env"
SERVE_SCRIPT="$HOME_DIR/serve.sh"
LAUNCH_SCRIPT="$HOME_DIR/launch.sh"

mkdir -p "$HOME_DIR"

# --- 1. venv + litellm ------------------------------------------------------
if [[ ! -d "$VENV_DIR" ]]; then
  echo ">> Creating virtualenv in $VENV_DIR"
  python3 -m venv "$VENV_DIR"
fi
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"
if ! python -c "import litellm" 2>/dev/null; then
  echo ">> Installing litellm[proxy]"
  pip install --quiet --upgrade pip
  pip install --quiet 'litellm[proxy]'
fi
deactivate

# --- 2. LiteLLM config ------------------------------------------------------
cat > "$CONFIG_FILE" <<YAML
model_list:
  - model_name: ${MAIN_MODEL_NAME}
    litellm_params:
      model: azure/${MAIN_DEPLOYMENT}
      api_base: ${AZURE_API_BASE}
      api_key: os.environ/AZURE_API_KEY
      api_version: "${AZURE_API_VERSION}"
    model_info:
      base_model: ${MAIN_BASE_MODEL}
  - model_name: ${FAST_MODEL_NAME}
    litellm_params:
      model: azure/${FAST_DEPLOYMENT}
      api_base: ${AZURE_API_BASE}
      api_key: os.environ/AZURE_API_KEY
      api_version: "${AZURE_API_VERSION}"
    model_info:
      base_model: ${FAST_BASE_MODEL}

litellm_settings:
  drop_params: true

general_settings:
  master_key: ${PROXY_MASTER_KEY}
YAML
echo ">> Wrote $CONFIG_FILE"

# --- 3. env file (secrets + settings) ---------------------------------------
cat > "$ENV_FILE" <<ENV
# Sourced by serve.sh / launch.sh. Keep this file private.
export AZURE_API_KEY="${AZURE_API_KEY}"
export PROXY_PORT="${PROXY_PORT}"
export CLAUDE_AZURE_DIR="${HOME_DIR}"
export CLAUDE_AZURE_CONFIG="${CONFIG_FILE}"
export CLAUDE_AZURE_VENV="${VENV_DIR}"
export CLAUDE_AZURE_SETTINGS="\$HOME/.claude/settings.azure.json"
ENV
chmod 600 "$ENV_FILE"
echo ">> Wrote $ENV_FILE (chmod 600)"

# --- 4. serve.sh: bring the proxy up ----------------------------------------
cat > "$SERVE_SCRIPT" <<'SERVE'
#!/usr/bin/env bash
# Starts the LiteLLM proxy in the foreground.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/env"
# shellcheck disable=SC1091
source "$CLAUDE_AZURE_VENV/bin/activate"
echo ">> LiteLLM proxy on http://localhost:${PROXY_PORT} (Ctrl-C to stop)"
exec litellm --config "$CLAUDE_AZURE_CONFIG" --port "$PROXY_PORT"
SERVE
chmod +x "$SERVE_SCRIPT"
echo ">> Wrote $SERVE_SCRIPT"

# --- 5. launch.sh: start proxy if needed, then run Claude Code --------------
cat > "$LAUNCH_SCRIPT" <<'LAUNCH'
#!/usr/bin/env bash
# Ensures the proxy is running (starts it in the background if not),
# then launches Claude Code against it. Extra args are passed to `claude`.
set -euo pipefail
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck disable=SC1091
source "$DIR/env"

LOG="$DIR/proxy.log"
PIDFILE="$DIR/proxy.pid"

proxy_up() {
  curl -s -o /dev/null -w "%{http_code}" \
    "http://localhost:${PROXY_PORT}/health/liveliness" 2>/dev/null | grep -q "200"
}

started_here=false
if proxy_up; then
  echo ">> Proxy already running on :${PROXY_PORT}"
else
  echo ">> Starting proxy in background (log: $LOG)"
  # shellcheck disable=SC1091
  source "$CLAUDE_AZURE_VENV/bin/activate"
  AZURE_API_KEY="$AZURE_API_KEY" nohup \
    litellm --config "$CLAUDE_AZURE_CONFIG" --port "$PROXY_PORT" \
    >"$LOG" 2>&1 &
  echo $! > "$PIDFILE"
  started_here=true
  # wait up to ~30s for it to come up
  for _ in $(seq 1 60); do
    proxy_up && break
    sleep 0.5
  done
  if ! proxy_up; then
    echo "ERROR: proxy failed to start. Last log lines:" >&2
    tail -n 20 "$LOG" >&2
    exit 1
  fi
  echo ">> Proxy is up (pid $(cat "$PIDFILE"))"
fi

echo ">> Launching Claude Code (Azure)"
set +e
claude --settings "$CLAUDE_AZURE_SETTINGS" "$@"
rc=$?
set -e

# If this launcher started the proxy, tear it down when Claude Code exits.
if [[ "$started_here" == "true" && -f "$PIDFILE" ]]; then
  echo ">> Stopping proxy (pid $(cat "$PIDFILE"))"
  kill "$(cat "$PIDFILE")" 2>/dev/null || true
  rm -f "$PIDFILE"
fi
exit $rc
LAUNCH
chmod +x "$LAUNCH_SCRIPT"
echo ">> Wrote $LAUNCH_SCRIPT"

# --- 6. ~/.claude/settings.azure.json ---------------------------------------
CLAUDE_DIR="$HOME/.claude"
SETTINGS_FILE="$CLAUDE_DIR/settings.azure.json"
mkdir -p "$CLAUDE_DIR"
cat > "$SETTINGS_FILE" <<JSON
{
  "env": {
    "ANTHROPIC_BASE_URL": "http://localhost:${PROXY_PORT}",
    "ANTHROPIC_API_KEY": "${PROXY_MASTER_KEY}",
    "ANTHROPIC_MODEL": "${MAIN_MODEL_NAME}",
    "ANTHROPIC_SMALL_FAST_MODEL": "${FAST_MODEL_NAME}",
    "CLAUDE_CODE_MAX_OUTPUT_TOKENS": "4096"
  }
}
JSON
echo ">> Wrote $SETTINGS_FILE"

# --- 7. zsh alias -----------------------------------------------------------
ALIAS_LINE="alias claude-az='${LAUNCH_SCRIPT}'"
MARKER="# >>> claude-az alias >>>"
END_MARKER="# <<< claude-az alias <<<"
touch "$ZSHRC"
if grep -qF "$MARKER" "$ZSHRC"; then
  tmp="$(mktemp)"
  awk -v marker="$MARKER" -v endm="$END_MARKER" -v line="$ALIAS_LINE" '
    $0==marker {skip=1; print marker; print line; print endm; next}
    skip && $0==endm {skip=0; next}
    !skip {print}
  ' "$ZSHRC" > "$tmp" && mv "$tmp" "$ZSHRC"
  echo ">> Updated claude-az alias in $ZSHRC"
else
  {
    echo ""
    echo "$MARKER"
    echo "$ALIAS_LINE"
    echo "$END_MARKER"
  } >> "$ZSHRC"
  echo ">> Added claude-az alias to $ZSHRC"
fi

echo
echo ">> Setup complete."
echo "   Reload your shell:   source $ZSHRC"
echo "   Then run:            claude-az"
echo "   (claude-az starts the proxy if needed, then launches Claude Code)"