"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GOOGLE_UNAVAILABLE, LOGIN_FAILURE } from "@/lib/auth/messages";

export function LoginForm({
  initialMessage,
  googleEnabled,
}: {
  initialMessage?: string;
  googleEnabled: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState(initialMessage ?? "");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const formData = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirect: false,
    });
    setPending(false);
    if (result?.ok) {
      router.push("/account");
      router.refresh();
      return;
    }
    setMessage(LOGIN_FAILURE);
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4" noValidate>
      {message ? (
        <p role="alert" className="text-destructive">
          {message}
        </p>
      ) : null}
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="email">Email</Label>
        <Input id="email" name="email" type="email" autoComplete="username" required />
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
        />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? "Please wait" : "Log in"}
      </Button>
      {googleEnabled ? (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={pending}
          onClick={() => {
            setPending(true);
            void signIn("google", { callbackUrl: "/account" });
          }}
        >
          Continue with Google
        </Button>
      ) : (
        <div className="flex flex-col gap-2">
          <Button
            type="button"
            variant="secondary"
            className="w-full"
            disabled
            aria-describedby="google-unavailable"
          >
            Continue with Google
          </Button>
          <p id="google-unavailable" role="status" className="text-small text-muted-foreground">
            {GOOGLE_UNAVAILABLE}
          </p>
        </div>
      )}
    </form>
  );
}
