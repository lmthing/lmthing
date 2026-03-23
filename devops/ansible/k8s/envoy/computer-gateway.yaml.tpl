apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: computer-gw
  namespace: gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      hostname: "${COMPUTER_DOMAIN}"
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
    - name: https
      hostname: "${COMPUTER_DOMAIN}"
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: lmthing-computer-tls
            kind: Secret
      allowedRoutes:
        namespaces:
          from: Same
