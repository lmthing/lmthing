# DevOps

Infrastructure automation for `lmthing` lives here. The initial setup focuses on bringing up a Kubernetes cluster with Kubespray while keeping the node inventory static and versioned in this repository.

## Layout

```text
devops/
├── README.md
├── ansible/
│   ├── README.md
│   ├── Makefile
│   ├── ansible.cfg
│   ├── requirements.yml
│   ├── playbooks/
│   │   └── kubespray.yml
│   ├── roles/
│   │   └── k8s_postinstall/
│   ├── inventory/
│   │   └── test/
│   │       ├── hosts.yml
│   │       └── group_vars/
│   │           └── all.yml
│   └── scripts/
│       └── setup/
│           └── bootstrap.sh
└── docs/
    └── getting-started/
        └── kubespray-test.md
```

## Quick Start

1. Edit `ansible/inventory/test/hosts.yml` with the real SSH user, key, and node IPs.
2. Review `ansible/inventory/test/group_vars/all.yml` and adjust cluster options.
3. Run `cd devops/ansible && make bootstrap`.
4. Validate connectivity with `make inventory` and `make ping`.
5. Deploy the cluster with `make cluster`.

More detail lives in [docs/getting-started/kubespray-test.md](/home/dkats/lmthing/devops/docs/getting-started/kubespray-test.md).
