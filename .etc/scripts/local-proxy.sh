#!/bin/bash
set -e

# --- Configuration ---
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
CONFIG_FILE="$REPO_ROOT/services.yaml"
HOSTS_FILE="/etc/hosts"
CERTS_DIR="$REPO_ROOT/.etc/certs"

# --- Colors ---
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
BOLD='\033[1m'
NC='\033[0m'

ok()   { echo -e "  ${GREEN}✓${NC} $1"; }
info() { echo -e "  ${CYAN}→${NC} $1"; }
warn() { echo -e "  ${YELLOW}!${NC} $1"; }
err()  { echo -e "  ${RED}✗${NC} $1"; }

# --- Validate Config ---
if [[ ! -f "$CONFIG_FILE" ]]; then
    err "Missing $CONFIG_FILE"
    exit 1
fi

# Read services from YAML
NAMES=()
DOMAINS=()
PORTS=()
PROD_DOMAINS=()
current_name="" current_domain="" current_local="" current_port=""
while IFS= read -r line || [[ -n "$line" ]]; do
    [[ "$line" =~ ^[[:space:]]*#|^$ ]] && continue
    if [[ "$line" =~ ^[[:space:]]*-[[:space:]]*name:[[:space:]]*(.+) ]]; then
        # Flush previous entry
        if [[ -n "$current_local" && -n "$current_port" ]]; then
            NAMES+=("$current_name")
            DOMAINS+=("$current_local")
            PORTS+=("$current_port")
            PROD_DOMAINS+=("$current_domain")
        fi
        current_name="${BASH_REMATCH[1]}" current_domain="" current_local="" current_port=""
    elif [[ "$line" =~ ^[[:space:]]*domain:[[:space:]]*(.+) ]]; then
        current_domain="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ^[[:space:]]*local:[[:space:]]*(.+) ]]; then
        current_local="${BASH_REMATCH[1]}"
    elif [[ "$line" =~ ^[[:space:]]*port:[[:space:]]*(.+) ]]; then
        current_port="${BASH_REMATCH[1]}"
    fi
done < "$CONFIG_FILE"
# Flush last entry
if [[ -n "$current_local" && -n "$current_port" ]]; then
    NAMES+=("$current_name")
    DOMAINS+=("$current_local")
    PORTS+=("$current_port")
    PROD_DOMAINS+=("$current_domain")
fi

if [[ ${#DOMAINS[@]} -eq 0 ]]; then
    err "No services found in $CONFIG_FILE"
    exit 1
fi

# --- OS Detection ---
OS="$(uname -s)"
if [[ "$OS" == "Darwin" ]]; then
    BREW_PREFIX=$(brew --prefix 2>/dev/null || echo "/opt/homebrew")
    NGINX_CONF_DIR="$BREW_PREFIX/etc/nginx/servers"
    RESTART_CMD="brew services restart nginx"
    TEST_CMD="nginx -t"
elif [[ "$OS" == "Linux" ]]; then
    NGINX_CONF_DIR="/etc/nginx/sites-available"
    NGINX_ENABLED_DIR="/etc/nginx/sites-enabled"
    RESTART_CMD="sudo systemctl restart nginx"
    TEST_CMD="sudo nginx -t"
else
    err "Unsupported OS: $OS"
    exit 1
fi

# --- Ensure sudo access ---
ensure_sudo() {
    if [[ $EUID -ne 0 ]]; then
        echo ""
        echo -e "${BOLD}This script needs sudo to modify /etc/hosts and nginx configs.${NC}"
        sudo -v || { err "sudo access required"; exit 1; }
    fi
}

# --- Teardown ---
if [[ "$1" == "--clean" ]]; then
    echo -e "\n${BOLD}Tearing down local proxy...${NC}\n"
    ensure_sudo

    for DOMAIN in "${DOMAINS[@]}"; do
        # Remove /etc/hosts entry
        if grep -q "127.0.0.1 $DOMAIN" "$HOSTS_FILE" 2>/dev/null; then
            sudo sed -i "/127.0.0.1 $DOMAIN/d" "$HOSTS_FILE"
            ok "Removed $DOMAIN from /etc/hosts"
        fi

        # Remove nginx config
        if [[ -f "$NGINX_CONF_DIR/$DOMAIN.conf" ]]; then
            sudo rm -f "$NGINX_CONF_DIR/$DOMAIN.conf"
            ok "Removed $NGINX_CONF_DIR/$DOMAIN.conf"
        fi
        if [[ "$OS" == "Linux" && -f "$NGINX_ENABLED_DIR/$DOMAIN.conf" ]]; then
            sudo rm -f "$NGINX_ENABLED_DIR/$DOMAIN.conf"
        fi
    done

    # Remove certificates
    if [[ -d "$CERTS_DIR" ]]; then
        rm -rf "$CERTS_DIR"
        ok "Removed TLS certificates"
    fi

    if command -v nginx &>/dev/null; then
        eval "$RESTART_CMD" 2>/dev/null && ok "Restarted nginx" || warn "Could not restart nginx"
    fi

    echo -e "\n${GREEN}Clean complete.${NC}\n"
    exit 0
fi

# --- Setup ---
echo -e "\n${BOLD}Local Proxy Setup${NC}"
echo -e "Found ${#DOMAINS[@]} services in services.yaml\n"

# Step 1: Install nginx
echo -e "${BOLD}[1/5] nginx${NC}"
if command -v nginx &>/dev/null; then
    ok "nginx already installed"
else
    info "Installing nginx..."
    ensure_sudo
    if [[ "$OS" == "Darwin" ]]; then
        brew install nginx
    else
        sudo apt-get update -qq && sudo apt-get install -y -qq nginx
    fi
    ok "nginx installed"
fi

# Ensure config dirs exist
if [[ "$OS" == "Darwin" ]]; then
    mkdir -p "$NGINX_CONF_DIR"
elif [[ "$OS" == "Linux" ]]; then
    sudo mkdir -p "$NGINX_CONF_DIR" "$NGINX_ENABLED_DIR"
fi

# Step 2: mkcert + TLS certificates
echo -e "\n${BOLD}[2/5] TLS certificates (mkcert)${NC}"
if ! command -v mkcert &>/dev/null; then
    info "Installing mkcert..."
    if [[ "$OS" == "Darwin" ]]; then
        brew install mkcert nss
    else
        sudo apt-get update -qq && sudo apt-get install -y -qq libnss3-tools
        # Install mkcert from GitHub releases
        MKCERT_VERSION="v1.4.4"
        MKCERT_ARCH="$(uname -m)"
        [[ "$MKCERT_ARCH" == "x86_64" ]] && MKCERT_ARCH="amd64"
        [[ "$MKCERT_ARCH" == "aarch64" ]] && MKCERT_ARCH="arm64"
        sudo curl -fsSL "https://dl.filippo.io/mkcert/latest?for=linux/${MKCERT_ARCH}" -o /usr/local/bin/mkcert
        sudo chmod +x /usr/local/bin/mkcert
    fi
    ok "mkcert installed"
fi

# Install local CA if not already done
if ! mkcert -check 2>/dev/null; then
    info "Installing local CA into system trust store..."
    mkcert -install
    ok "Local CA installed"
else
    ok "Local CA already trusted"
fi

# Generate certificates for all domains
mkdir -p "$CERTS_DIR"
CERT_DOMAINS=()
for DOMAIN in "${DOMAINS[@]}"; do
    CERT_DOMAINS+=("$DOMAIN")
done

# Single cert covering all domains
CERT_FILE="$CERTS_DIR/local.pem"
KEY_FILE="$CERTS_DIR/local-key.pem"
if [[ -f "$CERT_FILE" && -f "$KEY_FILE" ]]; then
    # Check if cert covers all current domains
    NEEDS_REGEN=false
    for DOMAIN in "${DOMAINS[@]}"; do
        if ! openssl x509 -in "$CERT_FILE" -noout -text 2>/dev/null | grep -q "DNS:$DOMAIN"; then
            NEEDS_REGEN=true
            break
        fi
    done
    if $NEEDS_REGEN; then
        info "Regenerating cert to cover new domains..."
        mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${CERT_DOMAINS[@]}"
        ok "Certificate regenerated for ${#CERT_DOMAINS[@]} domains"
    else
        ok "Certificate already covers all domains"
    fi
else
    mkcert -cert-file "$CERT_FILE" -key-file "$KEY_FILE" "${CERT_DOMAINS[@]}"
    ok "Certificate generated for ${#CERT_DOMAINS[@]} domains"
fi

# Step 3: /etc/hosts
echo -e "\n${BOLD}[3/5] /etc/hosts${NC}"
HOSTS_CHANGED=false
for DOMAIN in "${DOMAINS[@]}"; do
    if grep -q "127.0.0.1 $DOMAIN" "$HOSTS_FILE" 2>/dev/null; then
        ok "$DOMAIN"
    else
        if ! $HOSTS_CHANGED; then
            ensure_sudo
        fi
        echo "127.0.0.1 $DOMAIN" | sudo tee -a "$HOSTS_FILE" > /dev/null
        ok "$DOMAIN (added)"
        HOSTS_CHANGED=true
    fi
done

# Step 4: nginx server blocks (HTTPS + HTTP redirect)
echo -e "\n${BOLD}[4/5] nginx configs${NC}"
CONFS_CHANGED=false
for i in "${!DOMAINS[@]}"; do
    DOMAIN="${DOMAINS[$i]}"
    PORT="${PORTS[$i]}"
    CONF_FILE="$NGINX_CONF_DIR/$DOMAIN.conf"

    if [[ "$OS" == "Linux" ]]; then
        CHECK_PATH="$NGINX_ENABLED_DIR/$DOMAIN.conf"
    else
        CHECK_PATH="$CONF_FILE"
    fi

    # Always regenerate configs to ensure HTTPS is configured
    if ! $CONFS_CHANGED; then
        ensure_sudo
    fi

    NGINX_BLOCK="server {
    listen 80;
    server_name $DOMAIN;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    server_name $DOMAIN;

    ssl_certificate $CERT_FILE;
    ssl_certificate_key $KEY_FILE;

    location / {
        proxy_pass http://127.0.0.1:$PORT;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \"upgrade\";
    }
}"
    if [[ "$OS" == "Darwin" ]]; then
        echo "$NGINX_BLOCK" > "$CONF_FILE"
    else
        echo "$NGINX_BLOCK" | sudo tee "$CONF_FILE" > /dev/null
        sudo ln -sf "$CONF_FILE" "$NGINX_ENABLED_DIR/$DOMAIN.conf"
    fi
    ok "$DOMAIN → :$PORT (https)"
    CONFS_CHANGED=true
done

# Step 5: Validate & restart
echo -e "\n${BOLD}[5/5] Validate & restart nginx${NC}"
if eval "$TEST_CMD" 2>/dev/null; then
    ok "Config valid"
    eval "$RESTART_CMD" 2>/dev/null
    ok "nginx restarted"
else
    err "nginx config test failed — check errors above"
    exit 1
fi

# Summary
echo -e "\n${GREEN}${BOLD}All set!${NC}\n"
for i in "${!DOMAINS[@]}"; do
    echo -e "  ${GREEN}https://${DOMAINS[$i]}${NC}  →  localhost:${PORTS[$i]}"
done
echo ""
