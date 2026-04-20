import { access } from "node:fs/promises"
import path from "node:path"
import { tool } from "@opencode-ai/plugin"

const BUILTIN_NETWORKS = new Set(["bridge", "host", "none"])

async function runCommand(command: string[], allowFailure = false) {
  const process = Bun.spawn(command, {
    stdout: "pipe",
    stderr: "pipe",
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])

  if (exitCode !== 0 && !allowFailure) {
    const details = (stderr || stdout).trim() || `exit code ${exitCode}`
    throw new Error(`${command.join(" ")} failed: ${details}`)
  }

  return {
    exitCode,
    stdout: stdout.trim(),
    stderr: stderr.trim(),
  }
}

async function ensureExists(targetPath: string, label: string) {
  try {
    await access(targetPath)
  } catch {
    throw new Error(`${label} not found: ${targetPath}`)
  }
}

function resolvePath(baseDir: string, targetPath: string) {
  return path.isAbsolute(targetPath) ? targetPath : path.resolve(baseDir, targetPath)
}

function flattenFlagPairs(flag: string, values?: Record<string, string>) {
  if (!values) {
    return []
  }

  return Object.entries(values)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .flatMap(([key, value]) => [flag, `${key}=${value}`])
}

async function inspectContainer(name: string) {
  const result = await runCommand([
    "docker",
    "inspect",
    "--format",
    "{{json .}}",
    name,
  ], true)

  if (result.exitCode !== 0 || !result.stdout) {
    return null
  }

  return JSON.parse(result.stdout) as {
    State?: { Status?: string }
    Config?: { Image?: string; Hostname?: string }
    NetworkSettings?: {
      Ports?: Record<string, unknown>
      Networks?: Record<string, { IPAddress?: string }>
    }
  }
}

function getContainerIp(inspected: Awaited<ReturnType<typeof inspectContainer>>, network: string) {
  const networks = inspected?.NetworkSettings?.Networks
  if (!networks) {
    return ""
  }

  if (network in networks) {
    return networks[network]?.IPAddress || ""
  }

  const firstNetwork = Object.values(networks)[0]
  return firstNetwork?.IPAddress || ""
}

function getPublishedPort(
  inspected: Awaited<ReturnType<typeof inspectContainer>>,
  containerPort: number,
) {
  const ports = inspected?.NetworkSettings?.Ports
  if (!ports) {
    return ""
  }

  const bindings = ports[`${containerPort}/tcp`]
  if (!Array.isArray(bindings) || bindings.length === 0) {
    return ""
  }

  return bindings[0]?.HostPort || ""
}

export default tool({
  description:
    "Build, replace, inspect, or remove host Docker preview containers that follow the t-<name> naming convention used by reverse proxies.",
  args: {
    action: tool.schema
      .enum(["up", "status", "down"])
      .default("up")
      .describe("Lifecycle action to perform."),
    name: tool.schema
      .string()
      .regex(/^t-[a-z0-9]+$/)
      .describe("Container name and hostname, for example t-demo."),
    dockerfile: tool.schema
      .string()
      .optional()
      .describe("Path to the Dockerfile, relative to the current OpenCode working directory. Defaults to Dockerfile."),
    contextPath: tool.schema
      .string()
      .optional()
      .describe("Docker build context path, relative to the current OpenCode working directory. Defaults to the current working directory."),
    imageTag: tool.schema
      .string()
      .optional()
      .describe("Image tag to build and run. Defaults to preview/<name>:latest."),
    network: tool.schema
      .string()
      .optional()
      .describe("Docker network to attach the container to. Defaults to OPENCODE_PREVIEW_NETWORK or bridge."),
    containerPort: tool.schema
      .number()
      .int()
      .positive()
      .optional()
      .describe("Container port the preview app listens on. Defaults to OPENCODE_PREVIEW_PORT or 5553."),
    publishPort: tool.schema
      .number()
      .int()
      .positive()
      .optional()
      .describe("Optional host port to publish, for example 5553."),
    buildArgs: tool.schema
      .record(tool.schema.string())
      .optional()
      .describe("Optional docker build arguments as key-value pairs."),
    environment: tool.schema
      .record(tool.schema.string())
      .optional()
      .describe("Optional container environment variables as key-value pairs."),
    command: tool.schema
      .array(tool.schema.string())
      .optional()
      .describe("Optional command override passed after the image name."),
  },
  async execute(args, context) {
    const sessionDir = context.directory || context.worktree || "/workspace"
    const network = args.network || process.env.OPENCODE_PREVIEW_NETWORK || "bridge"
    const containerPort =
      args.containerPort || Number(process.env.OPENCODE_PREVIEW_PORT || "5553")
    const imageTag = args.imageTag || `preview/${args.name}:latest`

    await runCommand(["docker", "version", "--format", "{{.Client.Version}}"])

    if (args.action === "down") {
      const removeResult = await runCommand(["docker", "rm", "-f", args.name], true)
      if (removeResult.exitCode !== 0) {
        return `Container ${args.name} is not present.`
      }

      return `Removed preview container ${args.name}.`
    }

    if (args.action === "status") {
      const inspected = await inspectContainer(args.name)
      if (!inspected) {
        return `Container ${args.name} was not found.`
      }

      const ipAddress = getContainerIp(inspected, network) || "unknown"
      const publishedPort = getPublishedPort(inspected, containerPort)
      const directHostUrl = publishedPort
        ? `http://127.0.0.1:${publishedPort}`
        : "not published"

      return [
        `Container: ${args.name}`,
        `Status: ${inspected.State?.Status || "unknown"}`,
        `Image: ${inspected.Config?.Image || "unknown"}`,
        `Hostname: ${inspected.Config?.Hostname || "unknown"}`,
        `Network: ${network}`,
        `IP: ${ipAddress}`,
        `Browser target: http://${args.name}:${containerPort}`,
        `Direct host target: ${directHostUrl}`,
      ].join("\n")
    }

    const buildContext = resolvePath(sessionDir, args.contextPath || ".")
    const dockerfile = resolvePath(sessionDir, args.dockerfile || path.join(buildContext, "Dockerfile"))

    await ensureExists(buildContext, "Build context")
    await ensureExists(dockerfile, "Dockerfile")

    if (!BUILTIN_NETWORKS.has(network)) {
      const networkCheck = await runCommand(["docker", "network", "inspect", network], true)
      if (networkCheck.exitCode !== 0) {
        await runCommand(["docker", "network", "create", network])
      }
    }

    await runCommand([
      "docker",
      "build",
      "--file",
      dockerfile,
      "--tag",
      imageTag,
      ...flattenFlagPairs("--build-arg", args.buildArgs),
      buildContext,
    ])

    await runCommand(["docker", "rm", "-f", args.name], true)

    const runArgs = [
      "docker",
      "run",
      "--detach",
      "--restart",
      "unless-stopped",
      "--name",
      args.name,
      "--hostname",
      args.name,
      "--label",
      "opencode.preview.managed=true",
      "--label",
      `opencode.preview.name=${args.name}`,
      "--label",
      `opencode.preview.port=${containerPort}`,
      "--network",
      network,
      "--expose",
      String(containerPort),
      ...(BUILTIN_NETWORKS.has(network) ? [] : ["--network-alias", args.name]),
      ...(args.publishPort === undefined
        ? []
        : ["--publish", `${args.publishPort}:${containerPort}`]),
      ...flattenFlagPairs("--env", args.environment),
      imageTag,
      ...(args.command || []),
    ]

    const started = await runCommand(runArgs)
    const inspected = await inspectContainer(args.name)
    const ipAddress = getContainerIp(inspected, network) || "unknown"
    const publishedPort = getPublishedPort(inspected, containerPort)
    const lines = [
      `Preview container ${args.name} is running.`,
      `Container ID: ${started.stdout || "unknown"}`,
      `Image: ${imageTag}`,
      `Dockerfile: ${dockerfile}`,
      `Build context: ${buildContext}`,
      `Network: ${network}`,
      `IP: ${ipAddress}`,
      `Browser target: http://${args.name}:${containerPort}`,
      !publishedPort
        ? "Direct host target: not published"
        : `Direct host target: http://127.0.0.1:${publishedPort}`,
    ]

    if (network === "bridge" && args.publishPort === undefined) {
      lines.push(
        "Routing note: Docker does not provide host-side container-name DNS on the default bridge by itself. Your reverse proxy resolver must supply that mapping, or you should publish a host port or use a shared user-defined Docker network.",
      )
    }

    return lines.join("\n")
  },
})