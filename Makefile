.PHONY: up down proxy proxy-clean install check show-cost show-resources

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

# Install all workspace dependencies
install:
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
