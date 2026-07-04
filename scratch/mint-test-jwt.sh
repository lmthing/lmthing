#!/usr/bin/env bash
# Mint a short-lived gateway HS256 JWT for the prod test user
# (user-379847043318834826) so a browser session can be seeded on
# lmthing.store / lmthing.app. Prints ONLY the token JSON, never the secret.
#
# Run:  bash scratch/mint-test-jwt.sh
# The base64 blob is scratch/mint.py (the JWT mint), base64 -w0 encoded so no
# shell quoting is needed through ssh. Regenerate with: base64 -w0 scratch/mint.py
set -euo pipefail

ssh -i ~/GEANT/lmthing/devops/terraform/generated/lmthing-test-key.pem \
    -o StrictHostKeyChecking=no azureuser@4.223.83.5 \
    'SECRET_B64=$(kubectl get secret lmthing-secrets -n lmthing -o jsonpath="{.data.GATEWAY_JWT_SECRET}" | base64 -d); export SECRET_B64; export LMUID=379847043318834826; echo aW1wb3J0IGhtYWMsaGFzaGxpYixiYXNlNjQsanNvbix0aW1lLG9zCmtleT1iYXNlNjQuYjY0ZGVjb2RlKG9zLmVudmlyb25bIlNFQ1JFVF9CNjQiXSkKZGVmIGIobyk6IHJldHVybiBiYXNlNjQudXJsc2FmZV9iNjRlbmNvZGUoanNvbi5kdW1wcyhvLHNlcGFyYXRvcnM9KCIsIiwiOiIpKS5lbmNvZGUoKSkucnN0cmlwKGIiPSIpLmRlY29kZSgpCmRlZiBzaWduKHApOgogICAgaD1iKHsiYWxnIjoiSFMyNTYiLCJ0eXAiOiJKV1QifSkrIi4iK2IocCkKICAgIHNpZz1iYXNlNjQudXJsc2FmZV9iNjRlbmNvZGUoaG1hYy5uZXcoa2V5LGguZW5jb2RlKCksaGFzaGxpYi5zaGEyNTYpLmRpZ2VzdCgpKS5yc3RyaXAoYiI9IikuZGVjb2RlKCkKICAgIHJldHVybiBoKyIuIitzaWcKbm93PWludCh0aW1lLnRpbWUoKSk7IHVpZD1vcy5lbnZpcm9uWyJMTVVJRCJdCnByaW50KGpzb24uZHVtcHMoeyJhY2Nlc3MiOnNpZ24oeyJlbWFpbCI6InRlc3RAbG10aGluZy5jbG91ZCIsInN1YiI6dWlkLCJpYXQiOm5vdywiZXhwIjpub3crNDMyMDB9KSwicmVmcmVzaCI6c2lnbih7InR5cGUiOiJyZWZyZXNoIiwic3ViIjp1aWQsImlhdCI6bm93LCJleHAiOm5vdysyNTkyMDAwfSksImV4cCI6KG5vdys0MzIwMCkqMTAwMCwidWlkIjp1aWR9KSkK | base64 -d | python3'
