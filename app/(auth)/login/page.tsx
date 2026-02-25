import { LoginForm } from "@/components/auth/login-form";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Log in | Polymarket",
};

export default function LoginPage() {
  return <LoginForm />;
}
