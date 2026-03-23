apiVersion: gateway.networking.k8s.io/v1
kind: Gateway
metadata:
  name: cloud-gw
  namespace: gateway
  annotations:
    cert-manager.io/cluster-issuer: letsencrypt-prod
spec:
  gatewayClassName: eg
  listeners:
    - name: http
      hostname: "${DOMAIN}"
      protocol: HTTP
      port: 80
      allowedRoutes:
        namespaces:
          from: Same
    - name: https
      hostname: "${DOMAIN}"
      protocol: HTTPS
      port: 443
      tls:
        mode: Terminate
        certificateRefs:
          - name: lmthing-cloud-tls
            kind: Secret
      allowedRoutes:
        namespaces:
          from: Same
