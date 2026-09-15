import { describe, expect, it } from "vitest";
import { buildOllamaChatAgentModel } from "./openrouter";

describe("buildOllamaChatAgentModel", () => {
  it("builds an OpenAI-compatible chat model for the configured Ollama model", () => {
    const model = buildOllamaChatAgentModel(
      "http://ollama:11434/v1/",
      "gemma4:31b-cloud",
    );

    expect(model.modelId).toBe("gemma4:31b-cloud");
    expect(model.provider).toContain("openrouter");
  });
});
