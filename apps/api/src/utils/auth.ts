// This file will help us with login (password/PIN hashing + making tokens)

import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { UserRole } from "@prisma/client";
import type { SignOptions } from "jsonwebtoken";

// Secret key used to sign tokens (must be in .env)
const JWT_SECRET = process.env.JWT_SECRET as string;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || "12h";

if (!JWT_SECRET) {
  throw new Error("JWT_SECRET missing in .env");
}

// ✅ Converts password/PIN into a safe hash for DB
export async function hashSecret(value: string) {
  return bcrypt.hash(value, 10);
}

// ✅ Checks input password/PIN against saved hash
export async function verifySecret(value: string, hash: string) {
  return bcrypt.compare(value, hash);
}


export function signToken(payload: { userId: string; role: UserRole }) {
  const options: SignOptions = {
    expiresIn: JWT_EXPIRES_IN as any
  };

  return jwt.sign(payload, JWT_SECRET, options);
}

