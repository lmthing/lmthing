.PHONY: up down proxy proxy-clean install

# Port assignments
STUDIO_PORT := 3000
CHAT_PORT   := 3001
COM_PORT    := 3002
SOCIAL_PORT := 3003
STORE_PORT  := 3004
SPACE_PORT  := 3005
TEAM_PORT   := 3006
BLOG_PORT   := 3007
CASA_PORT   := 3008

APPS := studio chat com social store space team blog casa

# Start all services in parallel, each on its own port
up:
	@echo "Starting all services..."
	@trap 'kill 0' INT TERM; \
	cd studio && pnpm vite --port $(STUDIO_PORT) & \
	cd chat   && pnpm vite --port $(CHAT_PORT) & \
	cd com    && pnpm vite --port $(COM_PORT) & \
	cd social && pnpm vite --port $(SOCIAL_PORT) & \
	cd store  && pnpm vite --port $(STORE_PORT) & \
	cd space  && pnpm vite --port $(SPACE_PORT) & \
	cd team   && pnpm vite --port $(TEAM_PORT) & \
	cd blog   && pnpm vite --port $(BLOG_PORT) & \
	cd casa   && pnpm vite --port $(CASA_PORT) & \
	wait

# Stop any running dev servers
down:
	@echo "Stopping all dev servers..."
	@-pkill -f "vite --port 300" 2>/dev/null || true
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
