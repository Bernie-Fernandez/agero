import { redirect } from "next/navigation";
import { getWorkerSession } from "@/lib/safety/worker-auth";
import { LoginForm } from "./login-form";

export default async function WorkerLoginPage() {
  const session = await getWorkerSession();
  if (session) redirect("/worker/dashboard");

  return (
    <div className="mx-auto max-w-sm pt-4">
      <h1 className="text-2xl font-semibold text-zinc-900 dark:text-zinc-50">Worker sign-in</h1>
      <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
        Enter your mobile number to receive a verification code.
      </p>
      <div className="mt-6">
        <LoginForm />
      </div>
    </div>
  );
}
