# OpenCode Deployment

This repository contains plain OpenCode deployments based on the official `ghcr.io/anomalyco/opencode:latest` image.

There is no custom image, no baked provider config, and no Jira, Microsoft, or GitLab-specific integration. Each user gets an isolated OpenCode service with its own auth, home volume, and workspace volume.

## What you get

- One multi-tenant Docker Compose file at `docker-compose.yml`
- One default tenant named `hajekj14`
- One plain Kubernetes YAML file at `kubernetes/opencode-pilot.yaml`
- Persistent home and workspace storage
- HTTP basic auth on every instance
- Runtime install of `git`, `bash`, `openssh-client`, `gcompat`, and CA certificates so the OpenCode terminal can clone repositories directly and load its PTY native library on Alpine

## Docker Compose

Edit `docker-compose.env.example` and replace the placeholder password values.

The default service is `hajekj14`. It publishes OpenCode on `127.0.0.1:4096` and applies hard Docker limits for CPU and RAM with these per-instance variables:

- `OPENCODE_MAX_CPUS_HAJEKJ14`
- `OPENCODE_MAX_MEMORY_HAJEKJ14`
- `OPENCODE_MAX_PIDS_HAJEKJ14`

Start the default tenant:

```powershell
docker compose --env-file docker-compose.env.example up -d
```

Stop it:

```powershell
docker compose --env-file docker-compose.env.example down
```

### Add another tenant

1. Copy the `hajekj14` service block in `docker-compose.yml`.
2. Rename the service, container, hostname, and volume names for the new user.
3. Add a new set of variables in `docker-compose.env.example` with a matching suffix such as `ANOTHER_USER`.
4. Set a unique host port and the per-instance CPU and RAM limits for that user.

Each tenant keeps its own OpenCode auth data under `/home/opencode` and its own cloned repositories under `/workspace`.

### Authentication and Providers

Server access stays protected with OpenCode HTTP basic auth through:

- `OPENCODE_SERVER_USERNAME_*`
- `OPENCODE_SERVER_PASSWORD_*`

Model/provider login is intentionally left to standard OpenCode behavior. Users should authenticate inside OpenCode with `/connect` or any supported environment variables. Those credentials persist in the tenant home volume.

## Kubernetes

`kubernetes/opencode-pilot.yaml` is a single-instance example using the same official image and the same runtime package install approach.

Before applying it, replace these placeholder values:

- `OPENCODE_SERVER_USERNAME`
- `OPENCODE_SERVER_PASSWORD`
- Resource requests and limits if the defaults do not match your cluster policy

Apply it with:

```powershell
kubectl apply -f kubernetes/opencode-pilot.yaml
```

## Notes

- Compose is multi-tenant by duplication: one Docker service per user.
- The default tenant is `hajekj14`.
- Each tenant has hard Docker CPU and RAM caps through `cpus` and `mem_limit`.
- The template pins `SHELL=/bin/bash` so OpenCode uses bash for PTY sessions instead of BusyBox ash from the base image.
- The OpenCode terminal works because the container installs `git`, `bash`, `ssh`, and Alpine `gcompat` before `opencode web` starts.
- `gcompat` is required on the official Alpine-based image because the PTY/native module expects the glibc loader path `/lib/ld-linux-x86-64.so.2`.
- No repositories are pre-cloned. Users clone what they need from inside the instance.