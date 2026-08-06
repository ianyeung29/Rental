import type { Metadata } from "next";
import PasswordResetForm from "../components/PasswordResetForm";

export const metadata: Metadata = {
  title: "Reset password · Anjurentals",
  description: "Reset an Anjurentals account password.",
  robots: { index: false, follow: false },
};

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const params = await searchParams;
  return <PasswordResetForm token={typeof params.token === "string" ? params.token : ""} />;
}
