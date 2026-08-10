import bcrypt from "bcryptjs";

export async function verifyPassword(password: string, passwordHash: string) {
  if (!passwordHash) {
    return false;
  }

  return bcrypt.compare(password, passwordHash);
}
