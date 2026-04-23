import { describe, expect, it } from "vitest";
import { renderErrorScreen, renderValueScreen } from "../../src/cli/render.js";

describe("ink renderer", () => {
  it("renders structured value output", () => {
    const output = renderValueScreen("Start Task", {
      jiraKey: "CRMCN-1234",
      warnings: ["partial figma context"],
    });

    expect(output).toContain("Start Task");
    expect(output).toContain("CRMCN-1234");
    expect(output).toContain("partial figma context");
  });

  it("renders structured error output", () => {
    const output = renderErrorScreen("VERIFY_FAILED", "Task verification failed.");
    expect(output).toContain("Vibe Flow Error");
    expect(output).toContain("VERIFY_FAILED");
    expect(output).toContain("Task verification failed.");
  });
});
