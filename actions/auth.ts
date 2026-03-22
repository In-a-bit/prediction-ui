"use server";

import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";

export async function signUp(formData: FormData) {
  const username = formData.get("username") as string;
  const password = formData.get("password") as string;

  if (!username || !password || password.length < 1) {
    return { error: "Username and password are required" };
  }

  if (username.length < 2) {
    return { error: "Username must be at least 2 characters" };
  }

  const existingUser = await prisma.user.findUnique({
    where: { username },
  });

  if (existingUser) {
    return { error: "Username already taken" };
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  await prisma.user.create({
    data: {
      username,
      hashedPassword,
    },
  });

  return { success: true };
}
