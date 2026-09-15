import { createFileRoute } from "@tanstack/react-router";
import { env } from "cloudflare:workers";
import { getAuth, hasSessionAuthConfig } from "@/lib/auth";
import { isSessionAuthMode } from "@/lib/auth-mode";
import { getAuthMode } from "@/lib/auth-mode";
import { AuthRepository } from "@/server/auth/repositories/AuthRepository";

async function authorizeSelfHostedBootstrap(request: Request) {
  if (
    getAuthMode(env.AUTH_MODE) !== "selfhosted_auth" ||
    request.method !== "POST" ||
    !new URL(request.url).pathname.endsWith("/sign-up/email")
  ) {
    return null;
  }

  const configuredToken = Reflect.get(env, "SETUP_TOKEN");
  const signupDisabled =
    Reflect.get(env, "SELFHOST_SIGNUP_DISABLED") === "true";
  const configuredEmail = Reflect.get(env, "INITIAL_OWNER_EMAIL");
  const suppliedToken = request.headers.get("x-openseo-setup-token");
  const invitationId = request.headers.get("x-openseo-invitation-id");
  const body: unknown = await request
    .clone()
    .json()
    .catch(() => null);
  const suppliedEmail =
    body &&
    typeof body === "object" &&
    "email" in body &&
    typeof body.email === "string"
      ? body.email.trim().toLowerCase()
      : "";

  if (
    invitationId &&
    suppliedEmail &&
    (await AuthRepository.hasPendingInvitation(invitationId, suppliedEmail))
  ) {
    return null;
  }

  if (
    signupDisabled ||
    typeof configuredToken !== "string" ||
    configuredToken.length < 32 ||
    suppliedToken !== configuredToken ||
    typeof configuredEmail !== "string" ||
    suppliedEmail !== configuredEmail.trim().toLowerCase()
  ) {
    return new Response("Self-hosted registration is invite-only", {
      status: 403,
    });
  }

  return null;
}

async function handleAuthRequest(request: Request) {
  if (!isSessionAuthMode(env.AUTH_MODE)) {
    return new Response("Not found", {
      status: 404,
    });
  }

  if (!hasSessionAuthConfig()) {
    return new Response("Missing Better Auth configuration", {
      status: 500,
    });
  }

  const bootstrapRejection = await authorizeSelfHostedBootstrap(request);
  if (bootstrapRejection) return bootstrapRejection;

  const auth = getAuth();
  return auth.handler(request);
}

export const Route = createFileRoute("/api/auth/$")({
  server: {
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return handleAuthRequest(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return handleAuthRequest(request);
      },
    },
  },
});
