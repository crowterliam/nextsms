import { betterAuth } from "better-auth";
import { createAuthMiddleware, APIError } from "better-auth/api";
import { getEnv } from "./env";
import { validatePassword } from "./password";

export function createAuth() {
  const env = getEnv();
  const baseURL = env.BETTER_AUTH_URL || "http://localhost:3000";
  return betterAuth({
    database: env.DB,
    secret: env.BETTER_AUTH_SECRET,
    baseURL,
    trustedOrigins: [baseURL],
    emailAndPassword: {
      enabled: true,
      minPasswordLength: 8,
    },
    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5 * 60,
      },
    },
    appName: "NSMS",
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        if (ctx.path !== "/sign-up/email") return;
        const pw = ctx.body?.password as string | undefined;
        if (pw) {
          const error = validatePassword(pw);
          if (error) {
            throw new APIError("BAD_REQUEST", { message: error });
          }
        }
      }),
    },
  });
}

export type Auth = ReturnType<typeof createAuth>;
