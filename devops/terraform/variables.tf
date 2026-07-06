# ── Azure Authentication ────────────────────────────────────────
variable "subscription_id" {
  description = "Azure subscription ID"
  type        = string
}

# ── Resource Naming ─────────────────────────────────────────────
variable "project" {
  description = "Project name used as prefix for all resources"
  type        = string
  default     = "lmthing"
}

variable "environment" {
  description = "Environment name (test, staging, prod)"
  type        = string
  default     = "test"
}

# ── Location ────────────────────────────────────────────────────
variable "location" {
  description = "Azure region for all resources"
  type        = string
  default     = "germanywestcentral"
}

# ── Network ─────────────────────────────────────────────────────
variable "vnet_address_space" {
  description = "Address space for the virtual network"
  type        = string
  default     = "10.0.0.0/16"
}

variable "subnet_address_prefix" {
  description = "Address prefix for the subnet"
  type        = string
  default     = "10.0.0.0/24"
}

variable "ssh_allowed_ips" {
  description = "CIDR blocks allowed to SSH into the VM (empty = open to all)"
  type        = list(string)
  default     = []
}

# ── Nodes ───────────────────────────────────────────────────────
# Define cluster nodes. Each entry creates a VM with a public IP + NIC.
# Roles: "control_plane" (runs etcd + K8s API), "worker" (runs workloads).
# The first control_plane node is also an etcd member and worker by default.
variable "nodes" {
  description = "Map of cluster nodes. Key = node name, value = configuration."
  type = map(object({
    role             = string           # "control_plane" or "worker"
    vm_size          = optional(string, "Standard_B4as_v2")
    os_disk_size_gb  = optional(number, 64)
    data_disk_size_gb = optional(number, 0)
  }))
  default = {
    node1 = {
      role    = "control_plane"
    }
  }
}

# ── User Pool (Phase 4: dedicated on-demand pool for user compute pods) ──
# Disabled by default: with enable_user_pool = false, local.all_nodes
# (main.tf) resolves to exactly var.nodes, so `terraform plan`/`apply` are a
# no-op against today's single-node cluster. Provisioning a VM is a real,
# billable, human-gated action — do not flip this to true without explicit
# approval (set it in terraform.tfvars, never edit the default here).
variable "enable_user_pool" {
  description = "Provision the dedicated user-pod node pool (user_pool_nodes). Costs real money — leave false until explicitly approved to purchase capacity."
  type        = bool
  default     = false
}

# Same shape as `nodes`. Merged into local.all_nodes (main.tf) only when
# enable_user_pool = true. The pool node is labelled lmthing.cloud/pool=user
# and tainted lmthing.cloud/pool=user:NoSchedule by the Kubespray inventory
# (see scripts/generate-inventory.sh), so only user-pod workloads — which
# carry a matching toleration — schedule onto it.
variable "user_pool_nodes" {
  description = "Map of dedicated user-pod pool worker nodes, added to the cluster only when enable_user_pool = true."
  type = map(object({
    role              = string # "worker" — pool nodes never run control plane
    vm_size           = optional(string, "Standard_B8as_v2")
    os_disk_size_gb   = optional(number, 64)
    data_disk_size_gb = optional(number, 0)
  }))
  default = {
    lmthing-user-pool-1 = {
      role              = "worker"
      vm_size           = "Standard_B8as_v2" # 8 vCPU / 32 GiB
      data_disk_size_gb = 256                # Premium_LRS data disk for node-local user PVCs — see azurerm_managed_disk.data in main.tf
    }
  }
}

variable "vm_admin_username" {
  description = "Admin username for all VMs"
  type        = string
  default     = "azureuser"
}

variable "ssh_public_key_path" {
  description = "Path to existing SSH public key. If empty, a new key pair is generated."
  type        = string
  default     = ""
}

# ── Tags ────────────────────────────────────────────────────────
variable "extra_tags" {
  description = "Additional tags to apply to all resources"
  type        = map(string)
  default     = {}
}
