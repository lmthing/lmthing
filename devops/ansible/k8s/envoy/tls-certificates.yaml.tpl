# Let's Encrypt ClusterIssuer for ACME HTTP-01 challenges
apiVersion: cert-manager.io/v1
kind: ClusterIssuer
metadata:
  name: letsencrypt-prod
spec:
  acme:
    email: "${ACME_EMAIL}"
    server: https://acme-v02.api.letsencrypt.org/directory
    privateKeySecretRef:
      name: letsencrypt-prod-key
    solvers:
      - http01:
          gatewayHTTPRoute:
            parentRefs:
              - name: cloud-gw
                namespace: gateway
                kind: Gateway

---
# TLS certificate for lmthing.cloud
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: lmthing-cloud-tls
  namespace: gateway
spec:
  secretName: lmthing-cloud-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - "${DOMAIN}"

---
# TLS certificate for lmthing.computer
apiVersion: cert-manager.io/v1
kind: Certificate
metadata:
  name: lmthing-computer-tls
  namespace: gateway
spec:
  secretName: lmthing-computer-tls
  issuerRef:
    name: letsencrypt-prod
    kind: ClusterIssuer
  dnsNames:
    - "${COMPUTER_DOMAIN}"
