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

# HTTP → HTTPS redirect is handled by traefik-config.yaml (redirectTo: websecure)
# ACME challenges are handled internally by Traefik on the web entrypoint
