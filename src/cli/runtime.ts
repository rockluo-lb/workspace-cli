import { createApp } from "../core/create-app.js";
import { renderValueScreen } from "./render.js";

export type AppContext = Awaited<ReturnType<typeof createApp>>;

export function createAppLoader(rootDir: string) {
  let cached: Promise<AppContext> | null = null;
  return async (): Promise<AppContext> => {
    cached ??= createApp(rootDir);
    return cached;
  };
}

export function printValue(title: string, value: unknown): void {
  process.stdout.write(renderValueScreen(title, value));
}
