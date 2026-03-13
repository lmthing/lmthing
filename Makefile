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
CASA_PORT     := 3008
COMPUTER_PORT := 3010

APPS := studio chat com social store space team blog casa computer

# Start all services in parallel, each on its own port
up:
	@echo "Starting all services..."
	@trap 'kill 0' INT TERM; \
	cd studio && pnpm vp dev --port $(STUDIO_PORT) & \
	cd chat   && pnpm vp dev --port $(CHAT_PORT) & \
	cd com    && pnpm vp dev --port $(COM_PORT) & \
	cd social && pnpm vp dev --port $(SOCIAL_PORT) & \
	cd store  && pnpm vp dev --port $(STORE_PORT) & \
	cd space  && pnpm vp dev --port $(SPACE_PORT) & \
	cd team   && pnpm vp dev --port $(TEAM_PORT) & \
	cd blog   && pnpm vp dev --port $(BLOG_PORT) & \
	cd casa     && pnpm vp dev --port $(CASA_PORT) & \
	cd computer && pnpm vp dev --port $(COMPUTER_PORT) & \
	wait

# Stop any running dev servers
down:
	@echo "Stopping all dev servers..."
	@-pkill -f "vp dev --port 30[01]" 2>/dev/null || true
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
