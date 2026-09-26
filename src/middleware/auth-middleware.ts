import { jwt } from "hono/jwt";
import type { Context, Next } from "hono";
import { SignatureKey } from "hono/utils/jwt/jws";

export const authMiddleware = async (c: Context, next: Next) => {
  return jwt({
    secret: process.env.JWT_SECRET as SignatureKey,
    alg: "HS256",
  })(c, next);
};

export default authMiddleware;
