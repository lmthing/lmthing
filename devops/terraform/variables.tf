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
