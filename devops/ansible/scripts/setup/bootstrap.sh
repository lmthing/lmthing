#!/usr/bin/env bash

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ANSIBLE_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
KUBESPRAY_REPO="${KUBESPRAY_REPO:-https://github.com/kubernetes-sigs/kubespray.git}"
KUBESPRAY_VERSION="${KUBESPRAY_VERSION:-v2.30.0}"
KUBESPRAY_DIR="${ANSIBLE_DIR}/.cache/kubespray"
VENV_DIR="${ANSIBLE_DIR}/.venv"
COLLECTIONS_DIR="${ANSIBLE_DIR}/.ansible/collections"

mkdir -p "${ANSIBLE_DIR}/.cache" "${COLLECTIONS_DIR}"

if [[ ! -d "${KUBESPRAY_DIR}/.git" ]]; then
  git clone --branch "${KUBESPRAY_VERSION}" --depth 1 "${KUBESPRAY_REPO}" "${KUBESPRAY_DIR}"
else
  git -C "${KUBESPRAY_DIR}" fetch --tags origin
  git -C "${KUBESPRAY_DIR}" checkout "${KUBESPRAY_VERSION}"
fi

python3 -m venv "${VENV_DIR}"
source "${VENV_DIR}/bin/activate"

python -m pip install --upgrade pip setuptools wheel
python -m pip install -r "${KUBESPRAY_DIR}/requirements.txt"
ansible-galaxy collection install -r "${ANSIBLE_DIR}/requirements.yml" -p "${COLLECTIONS_DIR}"

cat <<EOF
Bootstrap complete.

Next steps:
  1. Edit ${ANSIBLE_DIR}/inventory/test/hosts.yml
  2. Review ${ANSIBLE_DIR}/inventory/test/group_vars/all.yml
  3. Run: cd ${ANSIBLE_DIR} && make inventory && make ping && make cluster
EOF
