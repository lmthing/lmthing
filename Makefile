.PHONY: up down proxy proxy-clean install check vmsync vmdeploy

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

# Set up nginx proxy: *.local -> localhost ports
proxy:
	@cd .etc/scripts && bash local-proxy.sh

# Tear down nginx proxy configs and /etc/hosts entries
proxy-clean:
	@cd .etc/scripts && bash local-proxy.sh --clean

# Install all workspace dependencies
install:
	pnpm install

# Health check all lmthing.* domains (DNS, TLS, HTTPS, hosting config)
check:
	@bash .etc/scripts/check-domains.sh

# ── VM targets ───────────────────────────────────────────────
# Require VM_HOST and SSH_KEY (set in env or pass inline):
#   make vmsync VM_HOST=1.2.3.4 SSH_KEY=~/.ssh/key.pem
#   make vmdeploy VM_HOST=1.2.3.4 SSH_KEY=~/.ssh/key.pem VM_USER=ubuntu

VM_HOST ?=
SSH_KEY ?=
VM_USER ?= azureuser

_check_vm_args:
	@test -n "$(VM_HOST)" || (echo "ERROR: VM_HOST is required"; exit 1)
	@test -n "$(SSH_KEY)" || (echo "ERROR: SSH_KEY is required"; exit 1)

# Sync cloud/ and computer/ to VM without deploying
vmsync: _check_vm_args
	@echo "→ Syncing cloud/ to $(VM_USER)@$(VM_HOST):~/cloud/"
	@rsync -az --delete --exclude='node_modules' --exclude='.env' \
		-e "ssh -i $(SSH_KEY) -o StrictHostKeyChecking=accept-new" \
		cloud/ $(VM_USER)@$(VM_HOST):~/cloud/
	@if [ -d computer/dist ] && [ -f computer/Dockerfile ]; then \
		echo "→ Syncing computer/ to $(VM_USER)@$(VM_HOST):~/computer/"; \
		rsync -az --delete \
			-e "ssh -i $(SSH_KEY) -o StrictHostKeyChecking=accept-new" \
			computer/dist/ $(VM_USER)@$(VM_HOST):~/computer/dist/; \
		scp -i $(SSH_KEY) -o StrictHostKeyChecking=accept-new \
			computer/Dockerfile computer/nginx.conf \
			$(VM_USER)@$(VM_HOST):~/computer/; \
	fi
	@echo "✓ Sync complete"

# Full deploy: sync + build + apply + rollout
vmdeploy: _check_vm_args
	@bash cloud/scripts/deploy.sh --host $(VM_HOST) --key $(SSH_KEY) --user $(VM_USER)
