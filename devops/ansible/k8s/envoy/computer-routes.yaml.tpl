# HTTP -> HTTPS redirect
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: computer-http-redirect
  namespace: gateway
spec:
  parentRefs:
    - name: lmthing-gw
      sectionName: computer-http
  hostnames:
    - "${COMPUTER_DOMAIN}"
  rules:
    - filters:
        - type: RequestRedirect
          requestRedirect:
            scheme: https
            statusCode: 301

---
# /api/* -> Dynamic per-user backend (JWT-authenticated, Lua-routed)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: computer-api-proxy
  namespace: gateway
spec:
  parentRefs:
    - name: lmthing-gw
      sectionName: computer-https
  hostnames:
    - "${COMPUTER_DOMAIN}"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /api
      filters:
        - type: ExtensionRef
          extensionRef:
            group: gateway.envoyproxy.io
            kind: HTTPRouteFilter
            name: rewrite-host-from-header
      backendRefs:
        - group: gateway.envoyproxy.io
          kind: Backend
          name: dynamic-user-backend

---
# /* -> Static SPA fallback (computer frontend)
apiVersion: gateway.networking.k8s.io/v1
kind: HTTPRoute
metadata:
  name: computer-static
  namespace: gateway
spec:
  parentRefs:
    - name: lmthing-gw
      sectionName: computer-https
  hostnames:
    - "${COMPUTER_DOMAIN}"
  rules:
    - matches:
        - path:
            type: PathPrefix
            value: /
      backendRefs:
        - name: computer
          namespace: lmthing
          port: 80
