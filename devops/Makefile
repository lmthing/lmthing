SHELL := /bin/bash

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
TF_DIR := $(ROOT_DIR)/terraform
ANSIBLE_DIR := $(ROOT_DIR)/ansible
EXTRA_ARGS ?=

.PHONY: tf-init tf-plan tf-apply tf-destroy tf-output tf-inventory
.PHONY: up scale-up scale-down cluster deploy status vault-edit

# ── Terraform: Azure VMs ───────────────────────────────────────

tf-init:
	cd $(TF_DIR) && terraform init

tf-plan: tf-init
	cd $(TF_DIR) && terraform plan

tf-apply: tf-init
	cd $(TF_DIR) && terraform apply

tf-destroy:
	cd $(TF_DIR) && terraform destroy

tf-output:
	cd $(TF_DIR) && terraform output

# Generate Ansible inventory from Terraform outputs
tf-inventory:
	$(TF_DIR)/generate-inventory.sh

# ── Full Pipeline ──────────────────────────────────────────────

# First time: provision VMs → generate inventory → print next steps
up: tf-apply tf-inventory
	@echo ""
	@echo "VMs provisioned. Ansible inventory updated."
	@echo "Next steps:"
	@echo "  cd ansible && make bootstrap"
	@echo "  cd ansible && make ping"
	@echo "  cd ansible && make cluster"
	@echo "  cd ansible && make deploy"

# ── Scaling ────────────────────────────────────────────────────

# Scale up: add nodes in terraform.tfvars → provision VMs → update inventory → join cluster
# 1. Edit terraform/terraform.tfvars — add new entries to the nodes map
# 2. Run: make scale-up
scale-up: tf-apply tf-inventory
	cd $(ANSIBLE_DIR) && $(MAKE) scale $(if $(EXTRA_ARGS),EXTRA_ARGS="$(EXTRA_ARGS)")
	@echo ""
	@echo "New nodes provisioned and joined the cluster."
	@echo "Run 'cd ansible && make status' to verify."

# Scale down: remove nodes from cluster → remove from terraform → update inventory
# 1. First drain the node:  kubectl drain <node> --ignore-daemonsets --delete-emptydir-data
# 2. Then remove from cluster: kubectl delete node <node>
# 3. Remove the entry from terraform/terraform.tfvars
# 4. Run: make scale-down
scale-down: tf-apply tf-inventory
	@echo ""
	@echo "VMs destroyed. Inventory updated."
	@echo "Make sure you drained and deleted the node from K8s before running this."

# ── Convenience: forward to Ansible ────────────────────────────

cluster:
	cd $(ANSIBLE_DIR) && $(MAKE) cluster $(if $(EXTRA_ARGS),EXTRA_ARGS="$(EXTRA_ARGS)")

deploy:
	cd $(ANSIBLE_DIR) && $(MAKE) deploy $(if $(EXTRA_ARGS),EXTRA_ARGS="$(EXTRA_ARGS)")

status:
	cd $(ANSIBLE_DIR) && $(MAKE) status $(if $(EXTRA_ARGS),EXTRA_ARGS="$(EXTRA_ARGS)")

vault-edit:
	cd $(ANSIBLE_DIR) && source .venv/bin/activate && ansible-vault edit vault.yml
