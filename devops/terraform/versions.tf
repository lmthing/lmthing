terraform {
  required_version = ">= 1.5"

  backend "azurerm" {
    resource_group_name  = "lmthing-tfstate-rg"
    storage_account_name = "lmthingtfstate"
    container_name       = "tfstate"
    key                  = "lmthing.tfstate"
  }

  required_providers {
    azurerm = {
      source  = "hashicorp/azurerm"
      version = "~> 4.0"
    }
    tls = {
      source  = "hashicorp/tls"
      version = "~> 4.0"
    }
    local = {
      source  = "hashicorp/local"
      version = "~> 2.0"
    }
  }
}

provider "azurerm" {
  features {}
  subscription_id = var.subscription_id
}
