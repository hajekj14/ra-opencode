# OpenCode Deployment

This repository contains simple deployment options for one isolated OpenCode Web instance.

There is no Kustomize, Helm, or generator step.

## What you get

- One plain Kubernetes YAML file at `kubernetes/opencode-pilot.yaml`
- One plain Docker Compose file at `docker-compose.yml`
- One custom image definition at `Dockerfile`
- One init script that clones or refreshes the allowed GitLab repository
- One startup script that launches `opencode web` inside that repository

## Build the image

Build the custom image from the repository root.

```powershell
docker build -t ghcr.io/your-org/opencode-web:latest .
docker push ghcr.io/your-org/opencode-web:latest
```

Update the image reference in `kubernetes/opencode-pilot.yaml` or `docker-compose.env.example` after you publish the image.

## Docker Compose

Edit `docker-compose.env.example` and replace the placeholder values.

Then start the local deployment.

```powershell
docker compose --env-file docker-compose.env.example up -d --build
```

Stop it with:

```powershell
docker compose --env-file docker-compose.env.example down
```

By default, the web UI is published only on `127.0.0.1:4096`.

## Edit the YAML

Before applying the manifest, replace these placeholder values in `kubernetes/opencode-pilot.yaml`:

- `change-me` secrets
- `https://your-azure-foundry-endpoint.example.com/v1`
- `https://gitlab.example.com/group/project.git`
- `project`
- `ghcr.io/your-org/opencode-web:latest`

For one user per repository, duplicate the YAML file and change the namespace, resource names, repo URL, repo directory, and credentials.

## Apply

After editing the placeholders, deploy with one command.

```powershell
kubectl apply -f kubernetes/opencode-pilot.yaml
```

## Notes

- This uses one OpenCode instance per user because upstream OpenCode only supports one basic-auth username and password per server instance.
- GitLab access is limited by the token you place in the secret. Use a read-only project token or deploy token for the single approved repository.
- JIRA is intentionally not included in this first cut.
- The Service is an internal AKS LoadBalancer.
- The Docker Compose deployment follows the same one-user one-repo model, just without Kubernetes.