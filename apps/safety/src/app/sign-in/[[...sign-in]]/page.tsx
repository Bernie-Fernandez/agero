import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-full flex-1 items-center justify-center bg-zinc-50 px-4 py-16 dark:bg-zinc-950">
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "shadow-lg border border-zinc-200 dark:border-zinc-800",
          },
        }}
      />
    </div>
  );
}
