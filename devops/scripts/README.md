# `devops/scripts/` — cluster access helpers

Thin wrappers around SSH + `kubectl` for the production cluster. They exist so you never hand-roll an
`ssh -i …` again, and so two recurring shell traps stop biting.

| Script | Does |
|---|---|
| `cluster-ssh.sh [cmd]` | interactive shell on the node, or run one command |
| `cluster-kubectl.sh <args…>` | `kubectl` on the node, args passed through |
| `cluster-logs.sh <deploy> [flags]` | follow a deployment's logs (`-f` by default) |
| `cluster-restart.sh <deploy>` \| `--all-user-pods` | roll-restart and wait for the rollout |

```bash
./devops/scripts/cluster-ssh.sh
./devops/scripts/cluster-kubectl.sh get pods -n lmthing -l app=org
./devops/scripts/cluster-logs.sh gateway --tail=200
NS=user-abc123 ./devops/scripts/cluster-restart.sh lmthing
```

## The key is not in the repo

It is **terraform output, so it is gitignored** — a fresh clone has no
`devops/terraform/generated/`. The scripts search that path, then
`~/GEANT/lmthing/devops/terraform/generated/`, then `~/.ssh/`, and `chmod 600` whatever they find (a
fresh terraform output can be `0644`, which ssh flatly refuses). If nothing matches they print every
path they tried. Override with `LMTHING_SSH_KEY` / `LMTHING_SSH_HOST`, or run `terraform apply` in
`devops/terraform` to regenerate the key.

## Two shell traps these absorb

**Never hold an ssh command in a string.** `SSH="ssh -i key host"; $SSH "cmd"` works in bash and
breaks in zsh — zsh does not word-split unquoted variables, so it tries to exec the whole string as a
single filename and reports `no such file or directory: ssh -i …`, which reads like a missing key when
the key is fine. `cluster-env.sh` keeps the invocation in a bash array instead.

**Quote brackets and braces yourself.** `cluster-kubectl.sh` `printf %q`-quotes each argument for the
*remote* shell, but your *local* shell expands first — an unquoted `-o jsonpath={.items[*].name}` dies
with zsh's `no matches found` before the script ever runs. Write `-o 'jsonpath={.items[*].name}'`.

What lives in which namespace, the routing model, per-user pods → [org/docs/devops](https://lmthing.org/devops).
