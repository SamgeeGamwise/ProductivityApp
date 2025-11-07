import { NextResponse } from "next/server";
import { promisify } from "util";
import { exec } from "child_process";

const execAsync = promisify(exec);
const REPO_ROOT = process.cwd();

export async function POST() {
  try {
    const { stdout, stderr } = await execAsync("git pull", { cwd: REPO_ROOT });
    return NextResponse.json({
      success: true,
      stdout: stdout.trim(),
      stderr: stderr.trim(),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    const stderr = typeof error === "object" && error && "stderr" in error ? String((error as any).stderr) : "";
    const stdout = typeof error === "object" && error && "stdout" in error ? String((error as any).stdout) : "";
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
