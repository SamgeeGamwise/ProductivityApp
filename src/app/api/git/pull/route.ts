import { NextResponse } from "next/server";
import { promisify } from "util";
import { exec } from "child_process";

export const runtime = "nodejs";

const execAsync = promisify(exec);
const REPO_ROOT = process.cwd();
type ExecError = Error & { stderr?: string; stdout?: string };

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync("git pull", { cwd: REPO_ROOT });
    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (error) {
    const execError = error as ExecError;
    const message = error instanceof Error ? error.message : "Unknown error";
    const stderr = typeof execError.stderr === "string" ? execError.stderr : "";
    const stdout = typeof execError.stdout === "string" ? execError.stdout : "";
    return NextResponse.json(
      {
        success: false,
        error: message,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
      },
      { status: 500 }
    );
  }
}

export function GET() {
  return NextResponse.json({ error: "Use POST" }, { status: 405 });
}
