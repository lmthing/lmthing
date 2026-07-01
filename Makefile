.PHONY: up down proxy proxy-clean install check show-cost show-resources \
        local-up local-down local-k8s-setup local-compute-image local-pods local-pod-logs local-compute-env

# Parse services by type from services.yaml
VITE_SERVICES := $(shell awk '/- name:/{name=$$3} /type: vite/{print name}' services.yaml)
SUPABASE_SERVICES := $(shell awk '/- name:/{name=$$3} /type: supabase/{print name}' services.yaml)
SERVICES := $(VITE_SERVICES) $(SUPABASE_SERVICES)

# Extract field for a given service name (usage: $(call field,SERVICE,FIELD))
field = $(shell awk '/- name: $(1)/{found=1} found && /$(2):/{gsub(/["\x27]/, ""); print $$2; exit}' services.yaml)

# Shortcuts
port = $(call field,$(1),port)
color = $(call field,$(1),color)
emoji = $(call field,$(1),emoji)

# Start all services in parallel, each on its own port
up:
	@echo "Freeing service ports..."
	@$(foreach svc,$(SERVICES),fuser -k $(call port,$(svc))/tcp 2>/dev/null || true;)
	@echo "Starting all services..."
	@trap 'kill 0' INT TERM; \
	$(foreach svc,$(VITE_SERVICES),(cd $(svc) && pnpm dev --port $(call port,$(svc)) --strictPort) 2>&1 | sed -u "s/^/\x1b[$(call color,$(svc))m$(call emoji,$(svc)) $(svc)\x1b[0m | /" & ) \
	$(foreach svc,$(SUPABASE_SERVICES),(cd $(svc) && pnpm dev) 2>&1 | sed -u "s/^/\x1b[$(call color,$(svc))m$(call emoji,$(svc)) $(svc)\x1b[0m | /" & ) \
	wait

# Stop any running dev servers
down:
	@echo "Stopping all dev servers..."
	@$(foreach svc,$(SERVICES),fuser -k $(call port,$(svc))/tcp 2>/dev/null || true;)
	@echo "Done."

# Set up nginx proxy: *.test -> localhost ports
proxy:
	@cd .etc/scripts && bash local-proxy.sh

# Tear down nginx proxy configs and /etc/hosts entries
proxy-clean:
	@cd .etc/scripts && bash local-proxy.sh --clean

# Install all workspace dependencies (initialises git submodules first)
install:
	git submodule update --init --recursive
	pnpm install

# Health check all lmthing.* domains (DNS, TLS, HTTPS, hosting config)
check:
	@bash .etc/scripts/check-domains.sh

# Show Azure cost breakdown for current month (requires az CLI login)
show-cost:
	@bash .etc/scripts/show-cost.sh

# Show all Azure resources by group and VM power state (requires az CLI login)
show-resources:
	@bash .etc/scripts/show-resources.sh

# ── Local dev with minikube ──────────────────────────────────────────────────

# One-time setup: start minikube and apply compute RBAC.
# Prints the minikube IP — copy it to cloud/gateway/.env.local as MINIKUBE_IP.
local-k8s-setup:
	minikube start --driver=docker --cpus=4 --memory=4096
	kubectl apply -f devops/local/k8s/compute-rbac.yaml
	@echo ""
	@echo "minikube IP: $$(minikube ip)"
	@echo "→ Add MINIKUBE_IP=$$(minikube ip) to cloud/gateway/.env.local"

# Build the compute pod image and load it into minikube's image store.
# Re-run after changing sdk/org/libs/{core,cli,ui}.
local-compute-image:
	git submodule update --init sdk/org
	docker build -f devops/argocd/compute/Dockerfile sdk/org/ -t compute:local
	minikube image load compute:local
	@echo "compute:local loaded into minikube"

# Start the full local stack:
#   - Postgres + LiteLLM via Docker Compose
#   - kubectl proxy (K8s API on :8001)
#   - gateway dev server (port 3009)
#   - all Vite frontend apps
local-up:
	@echo "Starting Postgres + LiteLLM..."
	cd devops/local && docker compose up -d
	@echo "Starting kubectl proxy (K8s API on :8001)..."
	kubectl proxy --port=8001 &
	@echo "Starting gateway (port 3009)..."
	(cd cloud/gateway && set -a && . ./.env.local && set +a && PORT=3009 pnpm dev) &
	@echo "Starting frontend dev servers..."
	$(MAKE) up

# Stop everything started by local-up.
local-down:
	@$(MAKE) down
	@pkill -f "kubectl proxy" 2>/dev/null || true
	@pkill -f "cloud/gateway" 2>/dev/null || true
	cd devops/local && docker compose down

# Show all compute pods running in minikube.
local-pods:
	kubectl get pods -A -l app=compute

# Tail compute pod logs. Usage: make local-pod-logs USER_ID=local-dev-user
local-pod-logs:
	kubectl logs -n user-$(USER_ID) deployment/lmthing -f

# Seed the user-env secret for a compute pod from devops/local/.env.local.
# Usage: make local-compute-env USER_ID=local-dev-user  (default: local-dev-user)
# Re-run after changing .env.local; triggers a pod restart to pick up new values.
LOCAL_USER_ID ?= local-dev-user
local-compute-env:
	@set -a && . devops/local/.env.local && set +a && \
	kubectl create secret generic user-env \
	  --from-literal=AZURE_API_KEY="$$AZURE_API_KEY" \
	  --from-literal=AZURE_RESOURCE_NAME="$$AZURE_RESOURCE_NAME" \
	  --from-literal=LM_MODEL_XS="$$LM_MODEL_XS" \
	  --from-literal=LM_MODEL_S="$$LM_MODEL_S" \
	  --from-literal=LM_MODEL_M="$$LM_MODEL_M" \
	  --from-literal=LM_MODEL_L="$$LM_MODEL_L" \
	  --from-literal=LM_MODEL_M_R="$$LM_MODEL_M_R" \
	  --from-literal=LM_MODEL_L_R="$$LM_MODEL_L_R" \
	  --from-literal=TAVILY_API_KEY="$$TAVILY_API_KEY" \
	  -n user-$(LOCAL_USER_ID) \
	  --dry-run=client -o yaml | kubectl apply -f -
	kubectl rollout restart deployment/lmthing -n user-$(LOCAL_USER_ID)

# Run the compute server from source on the host with auto-reload.
# Set COMPUTE_LOCAL_URL=http://localhost:18080 in cloud/gateway/.env.local
# to route all pod traffic here instead of minikube pods.
# tsup --watch rebuilds on source changes; node --watch restarts the server.
local-compute-dev:
	@echo "Starting compute server with auto-reload..."
	@trap 'kill 0' INT TERM; \
	(cd sdk/org/libs/cli && pnpm dev) & \
	sleep 4 && node --env-file=devops/local/.env.local --watch sdk/org/libs/cli/dist/cli/bin.js serve --port 18080 --space sdk/org/libs/core/system-spaces/architect & \
	wait
