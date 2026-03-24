#!/usr/bin/env bash
# Bootstrap the Azure Storage Account used as Terraform remote backend.
# Run this ONCE before `terraform init -migrate-state`.
#
# Prerequisites: az login + subscription set
#
# Usage:
#   ./bootstrap-backend.sh
#   ./bootstrap-backend.sh -s <subscription_id> -l <location>

set -euo pipefail

# Defaults — must match backend config in versions.tf
RESOURCE_GROUP="lmthing-tfstate-rg"
STORAGE_ACCOUNT="lmthingtfstate"
CONTAINER="tfstate"
LOCATION="swedencentral"
SUBSCRIPTION_ID=""

while getopts "s:l:" opt; do
  case $opt in
    s) SUBSCRIPTION_ID="$OPTARG" ;;
    l) LOCATION="$OPTARG" ;;
    *) echo "Usage: $0 [-s subscription_id] [-l location]"; exit 1 ;;
  esac
done

if [[ -n "$SUBSCRIPTION_ID" ]]; then
  echo "Setting subscription to $SUBSCRIPTION_ID..."
  az account set --subscription "$SUBSCRIPTION_ID"
fi

echo "Creating resource group: $RESOURCE_GROUP (location: $LOCATION)..."
az group create \
  --name "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --tags project=lmthing managed_by=terraform purpose=tfstate \
  --output none

echo "Creating storage account: $STORAGE_ACCOUNT..."
az storage account create \
  --name "$STORAGE_ACCOUNT" \
  --resource-group "$RESOURCE_GROUP" \
  --location "$LOCATION" \
  --sku Standard_LRS \
  --kind StorageV2 \
  --allow-blob-public-access false \
  --tags project=lmthing managed_by=terraform purpose=tfstate \
  --output none

echo "Creating blob container: $CONTAINER..."
az storage container create \
  --name "$CONTAINER" \
  --account-name "$STORAGE_ACCOUNT" \
  --auth-mode login \
  --output none

echo ""
echo "Backend storage ready."
echo "  Resource Group:  $RESOURCE_GROUP"
echo "  Storage Account: $STORAGE_ACCOUNT"
echo "  Container:       $CONTAINER"
echo ""
echo "Next steps:"
echo "  cd devops/terraform"
echo "  terraform init -migrate-state"
