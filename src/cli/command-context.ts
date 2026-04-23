import { createApp } from "../core/create-app.js";

export async function loadCommandContext() {
  return createApp(process.cwd());
}
