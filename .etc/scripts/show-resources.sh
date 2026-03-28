#!/usr/bin/env bash
set -e

echo ""
echo "Azure Resources"
echo "==============="

echo ""
echo "Virtual Machines"
echo "----------------"
az vm list --show-details \
  --query "[].{Name:name, RG:resourceGroup, Size:hardwareProfile.vmSize, State:powerState}" \
  --output table

echo ""
echo "All Resources"
echo "-------------"
az resource list \
  --query "sort_by([].{Name:name, Type:type, Group:resourceGroup, Location:location}, &Group)" \
  --output table
echo ""
