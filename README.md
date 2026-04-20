# OpenCode Deployment

This repository contains a Docker Compose deployment built from a custom Debian/glibc OpenCode image and a separate plain Kubernetes example.

The Compose image bakes in terminal dependencies, the Docker CLI, and the Docker Compose v2 plugin. OpenCode reaches the host Docker daemon through the mounted socket and can use the built-in `bash` tool to run Docker workflows. Each user still gets an isolated OpenCode service with its own auth, home volume, and workspace volume.

## What you get

- One multi-tenant Docker Compose file at `docker-compose.yml`
- One default tenant named `hajekj14`
- One plain Kubernetes YAML file at `kubernetes/opencode-pilot.yaml`
- Host Docker access from OpenCode through the built-in `bash` tool
- Persistent home and workspace storage
- HTTP basic auth on every instance
- `git`, `bash`, `openssh-client`, CA certificates, the Docker CLI, and `docker compose` baked into the Compose image

## Docker Compose

Edit `docker-compose.env.example` and replace the placeholder password values.

The default service is `hajekj14`. It publishes OpenCode on `127.0.0.1:4096`, mounts the host Docker socket into the container, and applies hard Docker limits for CPU and RAM with these per-instance variables:

- `OPENCODE_MAX_CPUS_HAJEKJ14`
- `OPENCODE_MAX_MEMORY_HAJEKJ14`
- `OPENCODE_MAX_PIDS_HAJEKJ14`

For host Docker access you can also set:

- `OPENCODE_DOCKER_SOCKET`

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

### Host Docker Access

OpenCode does not ship a built-in Docker-specific tool. The built-in way to control Docker is the `bash` tool.

This Compose image includes the Docker CLI, the Docker Compose v2 plugin, and the mounted host Docker socket, so prompts can run commands like:

```bash
docker build -t preview/t-demo:latest -f Dockerfile .
docker compose up -d
docker rm -f t-demo || true
docker run -d --restart unless-stopped --name t-demo --hostname t-demo --network bridge --expose 5553 preview/t-demo:latest
```

The managed OpenCode config in `/etc/opencode/opencode.jsonc` explicitly allows `bash`, so Docker commands are available without a custom tool wrapper.

If you want preview containers to fit your existing Nginx naming rule, keep using names like `t-demo` for both the container name and hostname, and make sure the app listens on container port `5553`.

Your Nginx rule only works if the hostname `t-...` resolves to the container IP that is listening on port `5553`. Docker does not provide host-side container-name DNS on the default bridge by itself. If your resolver at `172.17.0.1` is backed by a real Docker-aware DNS service, the container naming will fit it. If not, publish the port explicitly with `docker run -p 5553:5553 ...` or run Nginx in Docker on a shared user-defined network instead.

### Authentication and Providers

Server access stays protected with OpenCode HTTP basic auth through:

- `OPENCODE_SERVER_USERNAME_*`
- `OPENCODE_SERVER_PASSWORD_*`

Model/provider login is intentionally left to standard OpenCode behavior. Users should authenticate inside OpenCode with `/connect` or any supported environment variables. Those credentials persist in the tenant home volume.

## Kubernetes

`kubernetes/opencode-pilot.yaml` is a single-instance example that still uses the upstream image and runtime package install approach.

Before applying it, replace these placeholder values:

- `OPENCODE_SERVER_USERNAME`
- `OPENCODE_SERVER_PASSWORD`
- Resource requests and limits if the defaults do not match your cluster policy

Apply it with:

```powershell
kubectl apply -f kubernetes/opencode-pilot.yaml
```

## Troubleshooting

If the web UI keeps showing a session as working after the backend has already finished, first confirm the server log shows `session.idle` or a completed prompt loop. In that case the problem is likely in the OpenCode web client state, not in this Debian/glibc container build.

The most useful checks are:

- Rebuild onto the current pinned OpenCode release in this repo.
- Hard refresh the browser tab or reopen the session.
- Check `/home/opencode/.local/share/opencode/log/*.log` for repeated `/global/event` disconnects or `NotFoundError` responses on stale `/session/:id` requests.

## Notes

- Compose is multi-tenant by duplication: one Docker service per user.
- The default tenant is `hajekj14`.
- Each tenant has hard Docker CPU and RAM caps through `cpus` and `mem_limit`.
- The Compose image pins `SHELL=/bin/bash` so OpenCode uses bash for PTY sessions.
- The Compose image uses Debian/glibc because PTY support is broken in the upstream Alpine image.
- The Compose image does not include a custom Docker tool. Docker access is provided through the built-in `bash` tool plus the mounted Docker socket and Compose plugin.
- No repositories are pre-cloned. Users clone what they need from inside the instance.