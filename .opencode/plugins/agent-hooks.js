import { existsSync } from "node:fs"
import { join } from "node:path"
import { spawn, spawnSync } from "node:child_process"

function runHook(projectRoot, name, values = {}) {
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

function filePath(args = {}) {
  return String(args.file_path ?? args.filePath ?? args.path ?? "")
}

export const AgentHooks = async ({ client, directory, worktree }) => {
  const projectRoot = worktree || directory
  const reporting = new Set()
  return {
    event: async ({ event }) => {
      if (event.type === "session.created") {
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
            AGENT_SESSION_ID: event.properties.info.id,
          },
        })
        child.unref()
        return
      }

      if (event.type !== "session.idle" || reporting.has(event.properties.sessionID)) return
      const sessionID = event.properties.sessionID
      const result = runHook(projectRoot, "stop", { sessionID })
      if (result.status === 0) return
      const reason = result.stdout.trim() || result.stderr.trim() || "Repository tests failed."
      reporting.add(sessionID)
      try {
        await client.session.promptAsync({
          path: { id: sessionID },
          query: { directory: projectRoot },
          body: { parts: [{ type: "text", text: reason }] },
        })
      } finally {
        reporting.delete(sessionID)
      }
    },
    "experimental.chat.system.transform": async (input, output) => {
      const result = runHook(projectRoot, "platform-guidance", { sessionID: input.sessionID })
      if (result.stdout.trim()) output.system.push(result.stdout.trim())
    },
    "tool.execute.before": async (input, output) => {
      if (input.tool !== "bash") return
      const result = runHook(projectRoot, "validate-commit-msg", {
        sessionID: input.sessionID,
        toolName: input.tool,
        command: output.args.command ?? "",
      })
      if (result.status !== 0) {
        throw new Error(result.stderr.trim() || "Commit message rejected by repository policy.")
      }
    },
    "tool.execute.after": async (input, output) => {
      if (!["edit", "write", "apply_patch"].includes(input.tool)) return
      const result = runHook(projectRoot, "post-edit", {
        sessionID: input.sessionID,
        toolName: input.tool,
        filePath: filePath(input.args),
      })
      const feedback = result.stdout.trim()
      if (feedback) output.output = `${output.output}\n\n${feedback}`
    },
  }
}
