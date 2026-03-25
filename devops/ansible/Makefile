SHELL := /bin/bash

ROOT_DIR := $(abspath $(dir $(lastword $(MAKEFILE_LIST))))
VENV_BIN := $(ROOT_DIR)/.venv/bin
ANSIBLE := $(VENV_BIN)/ansible
ANSIBLE_INVENTORY := $(VENV_BIN)/ansible-inventory
ANSIBLE_PLAYBOOK := $(VENV_BIN)/ansible-playbook
INVENTORY ?= $(ROOT_DIR)/inventory/test/hosts.yml
PLAYBOOK ?= $(ROOT_DIR)/playbooks/kubespray.yml
KUBESPRAY_DIR ?= $(ROOT_DIR)/.cache/kubespray
KUBESPRAY_REPO ?= https://github.com/kubernetes-sigs/kubespray.git
KUBESPRAY_VERSION ?= v2.30.0
EXTRA_ARGS ?=
SERVICES_PLAYBOOK ?= $(ROOT_DIR)/playbooks/services.yml

export ANSIBLE_CONFIG := $(ROOT_DIR)/ansible.cfg

.PHONY: bootstrap check-bootstrap inventory ping syntax cluster upgrade scale reset
.PHONY: deploy deploy-images deploy-secrets deploy-argocd status routes logs-gateway logs-litellm logs-argocd

bootstrap:
	KUBESPRAY_REPO=$(KUBESPRAY_REPO) KUBESPRAY_VERSION=$(KUBESPRAY_VERSION) $(ROOT_DIR)/scripts/setup/bootstrap.sh

check-bootstrap:
	@test -x "$(ANSIBLE_PLAYBOOK)" || (echo "Missing $(ANSIBLE_PLAYBOOK). Run 'make bootstrap' first." && exit 1)
	@test -d "$(KUBESPRAY_DIR)" || (echo "Missing $(KUBESPRAY_DIR). Run 'make bootstrap' first." && exit 1)

inventory: check-bootstrap
	$(ANSIBLE_INVENTORY) -i $(INVENTORY) --graph

ping: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) all -m ping $(EXTRA_ARGS)

syntax: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(PLAYBOOK) --syntax-check

cluster: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(PLAYBOOK) -b -v $(EXTRA_ARGS)

upgrade: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(KUBESPRAY_DIR)/upgrade-cluster.yml -b -v $(EXTRA_ARGS)

scale: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(KUBESPRAY_DIR)/scale.yml -b -v $(EXTRA_ARGS)

reset: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(KUBESPRAY_DIR)/reset.yml -b -v $(EXTRA_ARGS)

# ── Cloud services ─────────────────────────────────────────────

deploy: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(SERVICES_PLAYBOOK) -b -v --ask-vault-pass $(EXTRA_ARGS)

deploy-images: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(SERVICES_PLAYBOOK) -b -v --ask-vault-pass --tags images $(EXTRA_ARGS)

deploy-secrets: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(SERVICES_PLAYBOOK) -b -v --ask-vault-pass --tags secrets $(EXTRA_ARGS)

deploy-argocd: check-bootstrap
	$(ANSIBLE_PLAYBOOK) -i $(INVENTORY) $(SERVICES_PLAYBOOK) -b -v --ask-vault-pass --tags argocd $(EXTRA_ARGS)

status: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl get pods -n lmthing && echo '---' && kubectl get pods -n gateway && echo '---' && kubectl get pods -n argocd" $(EXTRA_ARGS)

routes: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl get gateways,httproutes,certificates -A" $(EXTRA_ARGS)

logs-gateway: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl -n lmthing logs deployment/gateway --tail=50" $(EXTRA_ARGS)

logs-litellm: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl -n lmthing logs deployment/litellm --tail=50" $(EXTRA_ARGS)

logs-argocd: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl -n argocd logs deployment/argocd-server --tail=50" $(EXTRA_ARGS)

argocd-apps: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl get applications -n argocd" $(EXTRA_ARGS)

argocd-sync: check-bootstrap
	$(ANSIBLE) -i $(INVENTORY) kube_control_plane[0] -b -m shell \
		-a "kubectl -n argocd patch application {{ APP }} --type merge -p '{\"operation\":{\"initiatedBy\":{\"username\":\"admin\"},\"sync\":{\"prune\":true}}}'" $(EXTRA_ARGS)
