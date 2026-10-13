"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { homeAfterSignIn } from "@/lib/auth/home-action";
import { LOGIN_FAILURE } from "@/lib/auth/messages";

export function LoginForm({ initialMessage }: { initialMessage?: string }) {
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
      router.push(await homeAfterSignIn());
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
    </form>
  );
}
