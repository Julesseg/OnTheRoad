import type { ExtensionAPI } from "@earendil-works/pi-coding-agent"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"

function root(cwd: string): string {
  const result = spawnSync("git", ["rev-parse", "--show-toplevel"], { cwd, encoding: "utf8" })
  return result.status === 0 ? result.stdout.trim() : cwd
}

function sessionID(ctx: { sessionManager: { getSessionFile(): string | undefined } }): string {
  return ctx.sessionManager.getSessionFile() ?? "session"
}

function hook(projectRoot: string, name: string, values: Record<string, string> = {}) {
  const extension = name === "validate-commit-msg" ? ".py" : ".sh"
  const script = join(projectRoot, ".agents", "hooks", `${name}${extension}`)
  if (!existsSync(script)) return { status: 0, stdout: "", stderr: "" }
  const result = spawnSync(script, [], {
    cwd: projectRoot,
    encoding: "utf8",
    env: {
      ...process.env,
      AGENT_PROJECT_DIR: projectRoot,
      AGENT_REMOTE: process.env.AGENT_REMOTE ?? "false",
      AGENT_ENV_FILE: process.env.AGENT_ENV_FILE ?? "",
      AGENT_SESSION_ID: values.sessionID ?? "session",
      AGENT_TOOL_NAME: values.toolName ?? "",
      AGENT_COMMAND: values.command ?? "",
      AGENT_FILE_PATH: values.filePath ?? "",
    },
  })
  return { status: result.status ?? 1, stdout: result.stdout ?? "", stderr: result.stderr ?? "" }
}

function filePath(input: Record<string, unknown>): string {
  return String(input.file_path ?? input.filePath ?? input.path ?? "")
}

export default function (pi: ExtensionAPI) {
  pi.on("session_start", async (_event, ctx) => {
    const projectRoot = root(ctx.cwd)
    const script = join(projectRoot, ".agents", "hooks", "session-start.sh")
    if (!existsSync(script)) return
    const child = spawn(script, [], {
      cwd: projectRoot,
      detached: true,
      stdio: "ignore",
      env: {
        ...process.env,
        AGENT_PROJECT_DIR: projectRoot,
        AGENT_REMOTE: process.env.AGENT_REMOTE ?? "false",
        AGENT_ENV_FILE: process.env.AGENT_ENV_FILE ?? "",
        AGENT_SESSION_ID: sessionID(ctx),
      },
    })
    child.unref()
  })

  pi.on("before_agent_start", async (event, ctx) => {
    const result = hook(root(ctx.cwd), "platform-guidance", { sessionID: sessionID(ctx) })
    const guidance = result.stdout.trim()
    if (guidance) return { systemPrompt: `${event.systemPrompt}\n\n${guidance}` }
  })

  pi.on("tool_call", async (event, ctx) => {
    if (event.toolName !== "bash") return
    const input = event.input as { command?: string }
    const result = hook(root(ctx.cwd), "validate-commit-msg", {
      sessionID: sessionID(ctx),
      toolName: event.toolName,
      command: input.command ?? "",
    })
    if (result.status !== 0) {
      return { block: true, reason: result.stderr.trim() || "Commit message rejected by repository policy." }
    }
  })

  pi.on("tool_result", async (event, ctx) => {
    if (event.isError || !["edit", "write", "apply_patch"].includes(event.toolName)) return
    const result = hook(root(ctx.cwd), "post-edit", {
      sessionID: sessionID(ctx),
      toolName: event.toolName,
      filePath: filePath(event.input),
    })
    const feedback = result.stdout.trim()
    if (!feedback) return
    return { content: [...event.content, { type: "text" as const, text: feedback }] }
  })

  pi.on("agent_settled", async (_event, ctx) => {
    const result = hook(root(ctx.cwd), "stop", { sessionID: sessionID(ctx) })
    if (result.status === 0) return
    const reason = result.stdout.trim() || result.stderr.trim() || "Repository tests failed."
    pi.sendMessage(
      { customType: "agent-hook", content: reason, display: true },
      { triggerTurn: true, deliverAs: "followUp" },
    )
  })
}
