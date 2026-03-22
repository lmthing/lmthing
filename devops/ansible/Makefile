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

export ANSIBLE_CONFIG := $(ROOT_DIR)/ansible.cfg

.PHONY: bootstrap check-bootstrap inventory ping syntax cluster upgrade scale reset

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
