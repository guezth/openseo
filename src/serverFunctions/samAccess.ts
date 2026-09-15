import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  getOptionalEnvValue,
  isHostedServerAuthMode,
} from "@/server/lib/runtime-env";
import { requireProjectContext } from "@/serverFunctions/middleware";

const AI_CONFIG_MISSING_MESSAGE =
  "AI is not configured for this deployment yet. Set OPENROUTER_API_KEY, or set AI_PROVIDER=ollama with OLLAMA_BASE_URL and OLLAMA_MODEL, restart OpenSEO, then confirm here.";

const projectScopedSchema = z.object({ projectId: z.string().min(1) });

type SamAccessStatus = {
  enabled: boolean;
  errorMessage: string | null;
};

// Gates the in-app AI agent (SAM) on an OpenRouter key being configured, the
// same way backlinks/AI-search gate on their DataForSEO subscriptions. Hosted
// deployments always have the key provisioned, so only self-hosted is checked.
export const getSamAccessSetupStatus = createServerFn({ method: "GET" })
  .middleware(requireProjectContext)
  .validator(projectScopedSchema)
  .handler(async (): Promise<SamAccessStatus> => {
    if (await isHostedServerAuthMode()) {
      return { enabled: true, errorMessage: null };
    }

    const provider = (await getOptionalEnvValue("AI_PROVIDER")) ?? "openrouter";
    const enabled =
      provider === "ollama"
        ? Boolean(
            (await getOptionalEnvValue("OLLAMA_BASE_URL")) &&
            (await getOptionalEnvValue("OLLAMA_MODEL")),
          )
        : provider === "openrouter" &&
          Boolean(await getOptionalEnvValue("OPENROUTER_API_KEY"));
    return {
      enabled,
      errorMessage: enabled ? null : AI_CONFIG_MISSING_MESSAGE,
    };
  });
