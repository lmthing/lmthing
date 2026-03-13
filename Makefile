.PHONY: up down proxy proxy-clean install

# Parse services from services.yaml (exclude cloud — it uses supabase functions serve)
SERVICES := $(shell grep '^\s*- name:' services.yaml | awk '{print $$3}' | grep -v cloud)

# Extract port for a given service name
port = $(shell awk '/- name: $(1)/{found=1} found && /port:/{print $$2; exit}' services.yaml)

# Start all services in parallel, each on its own port
up:
	@echo "Freeing service ports..."
	@$(foreach svc,$(SERVICES),fuser -k $(call port,$(svc))/tcp 2>/dev/null || true;)
	@echo "Starting all services..."
	@trap 'kill 0' INT TERM; \
	$(foreach svc,$(SERVICES),cd $(svc) && pnpm dev --port $(call port,$(svc)) --strictPort & ) \
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
