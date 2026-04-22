---
title: Start & Stop
description: Start and stop your computer to control costs while preserving data
order: 2
---

# Start & Stop

Start and stop your computer on demand to control costs. Stopping preserves your volume data while releasing machine resources.

## Stopping

Stopping your computer:
- Releases the CPU and RAM resources
- Preserves all volume data (files, packages, configurations)
- Stops billing for compute time
- Takes a few seconds to complete
- Status transitions: **running** → **stopped**

Use stopping when you don't need the computer running — overnight, weekends, vacations, or between work sessions.

## Starting

Starting your computer:
- Boots the machine with the same volume attached
- Restores all your files and configuration
- Resumes health checks
- Takes a few seconds including health check verification
- Status transitions: **stopped** → **running**

## How To

Use the computer dashboard UI or call the cloud API endpoints directly:
- **Stop:** POST to `stop-space` with your computer's ID
- **Start:** POST to `start-space` with your computer's ID

Both endpoints wait for the state transition to complete (30-second timeout) before returning.

## Cost Optimization

You only pay for compute when the machine is running. Develop a habit of stopping your computer when you're done working. Some users automate this with scheduled stops during off-hours.

## Important Notes

- Stopping does NOT delete your data — your volume is preserved
- Starting uses the same volume — nothing is lost
- If the machine won't start, check your subscription status first
- Repeatedly stopping and starting is fine — there's no penalty
