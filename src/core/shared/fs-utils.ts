import fs from "fs-extra";
import path from "node:path";

export async function writeJsonAtomic(filePath: string, value: unknown): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeJson(tempPath, value, { spaces: 2 });
  await fs.move(tempPath, filePath, { overwrite: true });
}

export async function writeTextAtomic(filePath: string, content: string): Promise<void> {
  await fs.ensureDir(path.dirname(filePath));
  const tempPath = `${filePath}.tmp`;
  await fs.writeFile(tempPath, content, "utf8");
  await fs.move(tempPath, filePath, { overwrite: true });
}
