apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: lmthing-ingress
  namespace: lmthing
spec:
  entryPoints:
    - websecure
  routes:
    # LiteLLM — OpenAI-compatible API
    - match: Host(`${DOMAIN}`) && PathPrefix(`/v1`)
      kind: Rule
      services:
        - name: litellm
          port: 4000

    # Gateway — auth, keys, billing, webhooks
    - match: Host(`${DOMAIN}`) && PathPrefix(`/api`)
      kind: Rule
      services:
        - name: gateway
          port: 3000

  tls:
    certResolver: letsencrypt
---
apiVersion: traefik.io/v1alpha1
kind: IngressRoute
metadata:
  name: computer-ingress
  namespace: lmthing
spec:
  entryPoints:
    - websecure
  routes:
    # lmthing.computer — static SPA with cross-origin isolation headers
    - match: Host(`lmthing.computer`)
      kind: Rule
      services:
        - name: computer
          port: 80

  tls:
    certResolver: letsencrypt

# HTTP → HTTPS redirect is handled by traefik-config.yaml (redirectTo: websecure)
# ACME challenges are handled internally by Traefik on the web entrypoint
