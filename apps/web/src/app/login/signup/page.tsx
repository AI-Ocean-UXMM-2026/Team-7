import { AuthForm } from "../auth-form";
import { authDestination } from "@/lib/auth";

export default async function SignUpPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  return <AuthForm mode="sign-up" next={authDestination(next ?? null)} />;
}
