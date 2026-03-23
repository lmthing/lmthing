# ── Per-Node Outputs ────────────────────────────────────────────
output "nodes" {
  description = "All node details (for inventory generation)"
  value = {
    for name, node in var.nodes : name => {
      public_ip  = azurerm_public_ip.node[name].ip_address
      private_ip = azurerm_network_interface.node[name].private_ip_address
      role       = node.role
      vm_size    = node.vm_size
    }
  }
}

output "resource_group_name" {
  description = "Name of the resource group"
  value       = azurerm_resource_group.main.name
}

# ── SSH ─────────────────────────────────────────────────────────
output "ssh_private_key_path" {
  description = "Path to the SSH private key"
  value       = local.ssh_private_key_path
}

output "admin_username" {
  description = "Admin username for all VMs"
  value       = var.vm_admin_username
}

# ── Convenience ─────────────────────────────────────────────────
output "ssh_commands" {
  description = "SSH commands for each node"
  value = {
    for name, _ in var.nodes : name =>
      "ssh -i ${local.ssh_private_key_path} ${var.vm_admin_username}@${azurerm_public_ip.node[name].ip_address}"
  }
}
