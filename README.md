# OpenCode Deployment

This repository contains a Docker Compose deployment built from a custom Debian/glibc OpenCode image and a separate plain Kubernetes example.

The Compose image bakes in terminal dependencies, the Docker CLI, and a global OpenCode custom tool for building and running preview containers through the host Docker daemon. Each user still gets an isolated OpenCode service with its own auth, home volume, and workspace volume.

## What you get

- One multi-tenant Docker Compose file at `docker-compose.yml`
- One default tenant named `hajekj14`
- One plain Kubernetes YAML file at `kubernetes/opencode-pilot.yaml`
- One global `docker_preview` OpenCode tool in the Compose image
- Persistent home and workspace storage
- HTTP basic auth on every instance
- `git`, `bash`, `openssh-client`, CA certificates, and the Docker CLI baked into the Compose image

## Docker Compose

Edit `docker-compose.env.example` and replace the placeholder password values.

The default service is `hajekj14`. It publishes OpenCode on `127.0.0.1:4096`, mounts the host Docker socket into the container, and applies hard Docker limits for CPU and RAM with these per-instance variables:

- `OPENCODE_MAX_CPUS_HAJEKJ14`
- `OPENCODE_MAX_MEMORY_HAJEKJ14`
- `OPENCODE_MAX_PIDS_HAJEKJ14`

For the global preview tool you can also set:

- `OPENCODE_DOCKER_SOCKET`
- `OPENCODE_PREVIEW_NETWORK`
- `OPENCODE_PREVIEW_PORT`

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

### Host Docker Previews

The Compose image includes a global OpenCode custom tool named `docker_preview`. It talks to the host Docker daemon through the mounted socket and is intended for preview containers that should match names like `t-demo.hajek.click`.

The tool supports these actions:

- `action: "up"` builds an image from a Dockerfile and replaces the container if it already exists
- `action: "status"` shows the container state, network, and resolved IP
- `action: "down"` removes the container

The required naming convention is `t-[a-z0-9]+`, because the tool uses the same value for the Docker container name and hostname. By default it expects the preview app to listen on container port `5553`.

Typical `up` arguments are:

- `name`: preview container and hostname, for example `t-demo`
- `dockerfile`: Dockerfile path relative to the current OpenCode working directory, default `Dockerfile`
- `contextPath`: Docker build context, default current working directory
- `network`: Docker network, default from `OPENCODE_PREVIEW_NETWORK` or `bridge`
- `publishPort`: optional host port if you also want direct host publishing
- `buildArgs` and `environment`: optional key-value maps forwarded to `docker build` and `docker run`

Your Nginx rule only works if the hostname `t-...` resolves to the container IP that is listening on port `5553`. Docker does not provide host-side container-name DNS on the default bridge by itself. If your resolver at `172.17.0.1` is backed by a real Docker-aware DNS service, the tool naming will fit it. If not, use `publishPort` or run Nginx in Docker on a shared user-defined network instead.

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

## Notes

- Compose is multi-tenant by duplication: one Docker service per user.
- The default tenant is `hajekj14`.
- Each tenant has hard Docker CPU and RAM caps through `cpus` and `mem_limit`.
- The Compose image pins `SHELL=/bin/bash` so OpenCode uses bash for PTY sessions.
- The Compose image uses Debian/glibc because PTY support is broken in the upstream Alpine image.
- The Compose image includes the `docker_preview` tool, but it still needs a mounted Docker socket and a host daemon that you trust the container to control.
- No repositories are pre-cloned. Users clone what they need from inside the instance.