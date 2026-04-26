import { createAuth } from "@/lib/auth";

export const runtime = "edge";

async function handleAuth(request: Request) {
  const auth = createAuth();
  return auth.handler(request);
}

export { handleAuth as GET, handleAuth as POST };
