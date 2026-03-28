#!/usr/bin/env bash
set -e

TOKEN=$(az account get-access-token --query accessToken -o tsv)
SUB=$(az account show --query id -o tsv)

echo ""
echo "Azure Cost — Month to Date"
echo "=========================="

curl -s -X POST \
  "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Usage",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {"totalCost": {"name": "PreTaxCost", "function": "Sum"}},
      "grouping": [{"type": "Dimension", "name": "ServiceName"}]
    }
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = sorted(data['properties']['rows'], key=lambda r: r[0], reverse=True)
print('%-40s %10s' % ('Service', 'EUR'))
print('-' * 52)
total = 0
for row in rows:
    cost, service = row[0], row[1]
    if cost > 0:
        print('%-40s %10.4f' % (service, cost))
        total += cost
print('-' * 52)
print('%-40s %10.4f' % ('TOTAL', total))
"

echo ""
echo "VM Breakdown"
echo "------------"

curl -s -X POST \
  "https://management.azure.com/subscriptions/$SUB/providers/Microsoft.CostManagement/query?api-version=2023-11-01" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "type": "Usage",
    "timeframe": "MonthToDate",
    "dataset": {
      "granularity": "None",
      "aggregation": {"totalCost": {"name": "PreTaxCost", "function": "Sum"}},
      "grouping": [{"type": "Dimension", "name": "ResourceId"}],
      "filter": {"dimensions": {"name": "ServiceName", "operator": "In", "values": ["Virtual Machines"]}}
    }
  }' | python3 -c "
import sys, json
data = json.load(sys.stdin)
rows = sorted(data['properties']['rows'], key=lambda r: r[0], reverse=True)
print('%-40s %10s' % ('VM', 'EUR'))
print('-' * 52)
for row in rows:
    cost, resource_id = row[0], row[1]
    if cost > 0:
        name = resource_id.split('/')[-1]
        print('%-40s %10.4f' % (name, cost))
"

echo ""
echo "Budget"
echo "------"
az consumption budget list \
  --query "[].{Budget:name, Amount:amount, Spent:currentSpend.amount, Reset:timeGrain}" \
  --output table 2>/dev/null | grep -v WARNING || true
echo ""
