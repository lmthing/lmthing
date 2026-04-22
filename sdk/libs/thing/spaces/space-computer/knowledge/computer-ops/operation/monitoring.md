---
title: Monitoring
description: Monitor your computer's health, resources, and performance
order: 4
---

# Monitoring

Monitor your computer's health and resource usage to catch issues before they cause problems.

## Health Checks

Health checks run automatically every 10 seconds via HTTP GET to `/health` with a 5-second timeout. A healthy machine responds with a 200 status code. If health checks fail repeatedly, the machine may be in a degraded state.

## Resource Monitoring

Your computer has limited resources (1 shared CPU, 1 GB RAM). Monitor usage to avoid exhaustion:

**CPU:**
- Run `top` or `htop` to see CPU usage per process
- High sustained CPU usage may slow down agent execution
- Kill runaway processes with `kill` or `killall`

**Memory:**
- Run `free -h` to check available memory
- Watch for out-of-memory (OOM) kills in system logs
- If memory is consistently high, review running processes

**Disk:**
- Run `df -h` to check volume usage
- The 1 GB volume can fill up with logs, packages, and workspace files
- Clear unnecessary files to free space: temp files, old logs, unused packages

## Dashboard Metrics

The computer dashboard shows:
- CPU and memory utilization graphs
- Active processes
- Health check status (passing/failing)
- Machine uptime

## Diagnostic Commands

```
top          # Real-time process and CPU monitoring
free -h      # Memory usage
df -h        # Disk usage
journalctl   # System logs
ps aux       # All running processes
```

## Warning Signs

- Health checks failing → machine may be overloaded or crashed
- Memory usage above 80% → risk of OOM kills
- Disk usage above 90% → volume nearly full, clean up needed
- High CPU for extended periods → check for runaway processes
