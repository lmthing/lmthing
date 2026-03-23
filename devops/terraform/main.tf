locals {
  prefix = "${var.project}-${var.environment}"
  tags = merge({
    project     = var.project
    environment = var.environment
    managed_by  = "terraform"
  }, var.extra_tags)

  control_plane_nodes = { for k, v in var.nodes : k => v if v.role == "control_plane" }
  worker_nodes        = { for k, v in var.nodes : k => v if v.role == "worker" }
}

# ── Resource Group ──────────────────────────────────────────────
resource "azurerm_resource_group" "main" {
  name     = "${local.prefix}-rg"
  location = var.location
  tags     = local.tags
}

# ── Network (shared) ───────────────────────────────────────────
resource "azurerm_virtual_network" "main" {
  name                = "${local.prefix}-vnet"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  address_space       = [var.vnet_address_space]
  tags                = local.tags
}

resource "azurerm_subnet" "main" {
  name                 = "${local.prefix}-subnet"
  resource_group_name  = azurerm_resource_group.main.name
  virtual_network_name = azurerm_virtual_network.main.name
  address_prefixes     = [var.subnet_address_prefix]
}

# ── Network Security Group (shared) ────────────────────────────
resource "azurerm_network_security_group" "main" {
  name                = "${local.prefix}-nsg"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = local.tags

  # SSH
  security_rule {
    name                       = "AllowSSH"
    priority                   = 100
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "22"
    source_address_prefixes    = length(var.ssh_allowed_ips) > 0 ? var.ssh_allowed_ips : ["0.0.0.0/0"]
    destination_address_prefix = "*"
  }

  # HTTP (ACME challenges + redirect)
  security_rule {
    name                       = "AllowHTTP"
    priority                   = 200
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "80"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # HTTPS
  security_rule {
    name                       = "AllowHTTPS"
    priority                   = 201
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "443"
    source_address_prefix      = "*"
    destination_address_prefix = "*"
  }

  # Kubernetes API (VNet internal for node-to-node)
  security_rule {
    name                       = "AllowK8sAPI"
    priority                   = 300
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "6443"
    source_address_prefix      = var.vnet_address_space
    destination_address_prefix = "*"
  }

  # Kubelet, NodePort, flannel/calico (VNet internal)
  security_rule {
    name                       = "AllowK8sInternal"
    priority                   = 301
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "*"
    source_port_range          = "*"
    destination_port_range     = "10250-10260"
    source_address_prefix      = var.vnet_address_space
    destination_address_prefix = "*"
  }

  # etcd (VNet internal)
  security_rule {
    name                       = "AllowEtcd"
    priority                   = 302
    direction                  = "Inbound"
    access                     = "Allow"
    protocol                   = "Tcp"
    source_port_range          = "*"
    destination_port_range     = "2379-2380"
    source_address_prefix      = var.vnet_address_space
    destination_address_prefix = "*"
  }
}

# ── SSH Key ─────────────────────────────────────────────────────
resource "tls_private_key" "ssh" {
  count     = var.ssh_public_key_path == "" ? 1 : 0
  algorithm = "RSA"
  rsa_bits  = 4096
}

resource "local_file" "ssh_private_key" {
  count           = var.ssh_public_key_path == "" ? 1 : 0
  content         = tls_private_key.ssh[0].private_key_pem
  filename        = "${path.module}/generated/${local.prefix}-key.pem"
  file_permission = "0600"
}

locals {
  ssh_public_key       = var.ssh_public_key_path != "" ? file(var.ssh_public_key_path) : tls_private_key.ssh[0].public_key_openssh
  ssh_private_key_path = var.ssh_public_key_path != "" ? replace(var.ssh_public_key_path, ".pub", "") : "${path.module}/generated/${local.prefix}-key.pem"
}

# ── Per-Node Resources ─────────────────────────────────────────
resource "azurerm_public_ip" "node" {
  for_each            = var.nodes
  name                = "${local.prefix}-${each.key}-pip"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  allocation_method   = "Static"
  sku                 = "Standard"
  tags                = merge(local.tags, { node = each.key, role = each.value.role })
}

resource "azurerm_network_interface" "node" {
  for_each            = var.nodes
  name                = "${local.prefix}-${each.key}-nic"
  location            = azurerm_resource_group.main.location
  resource_group_name = azurerm_resource_group.main.name
  tags                = merge(local.tags, { node = each.key, role = each.value.role })

  ip_configuration {
    name                          = "internal"
    subnet_id                     = azurerm_subnet.main.id
    private_ip_address_allocation = "Dynamic"
    public_ip_address_id          = azurerm_public_ip.node[each.key].id
  }
}

resource "azurerm_network_interface_security_group_association" "node" {
  for_each              = var.nodes
  network_interface_id  = azurerm_network_interface.node[each.key].id
  network_security_group_id = azurerm_network_security_group.main.id
}

resource "azurerm_linux_virtual_machine" "node" {
  for_each                        = var.nodes
  name                            = "${local.prefix}-${each.key}"
  location                        = azurerm_resource_group.main.location
  resource_group_name             = azurerm_resource_group.main.name
  size                            = each.value.vm_size
  admin_username                  = var.vm_admin_username
  disable_password_authentication = true
  tags                            = merge(local.tags, { node = each.key, role = each.value.role })

  network_interface_ids = [
    azurerm_network_interface.node[each.key].id
  ]

  admin_ssh_key {
    username   = var.vm_admin_username
    public_key = local.ssh_public_key
  }

  os_disk {
    name                 = "${local.prefix}-${each.key}-osdisk"
    caching              = "ReadWrite"
    storage_account_type = "Premium_LRS"
    disk_size_gb         = each.value.os_disk_size_gb
  }

  source_image_reference {
    publisher = "Canonical"
    offer     = "ubuntu-24_04-lts"
    sku       = "server"
    version   = "latest"
  }
}

# ── Data Disks (optional per node) ─────────────────────────────
resource "azurerm_managed_disk" "data" {
  for_each             = { for k, v in var.nodes : k => v if v.data_disk_size_gb > 0 }
  name                 = "${local.prefix}-${each.key}-datadisk"
  location             = azurerm_resource_group.main.location
  resource_group_name  = azurerm_resource_group.main.name
  storage_account_type = "Premium_LRS"
  create_option        = "Empty"
  disk_size_gb         = each.value.data_disk_size_gb
  tags                 = merge(local.tags, { node = each.key })
}

resource "azurerm_virtual_machine_data_disk_attachment" "data" {
  for_each           = { for k, v in var.nodes : k => v if v.data_disk_size_gb > 0 }
  managed_disk_id    = azurerm_managed_disk.data[each.key].id
  virtual_machine_id = azurerm_linux_virtual_machine.node[each.key].id
  lun                = 0
  caching            = "ReadWrite"
}
