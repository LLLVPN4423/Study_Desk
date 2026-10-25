"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useState } from "react";
import { Button } from "@/components/Button";
import { Icon } from "@/components/Icon";
import { displayNameFromEmail, saveSession } from "@/lib/session";

function AuthForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [signup, setSignup] = useState(params.get("mode") === "signup");
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.includes("@") || password.length < 8) {
      setError("We couldn’t sign you in. Check your email and password (8+ characters).");
      return;
    }
    const display = name.trim() || displayNameFromEmail(email);
    saveSession({
      id: crypto.randomUUID(),
      name: display,
      email: email.trim().toLowerCase(),
      plan: "free",
    });
    router.push("/desk");
  }

  return (
    <div className="auth-page">
      <Link href="/" className="wordmark small auth-brand">
        Study Desk<span>.</span>
      </Link>
      <form className="auth-panel" onSubmit={onSubmit}>
        <p className="eyebrow">Welcome to your desk</p>
        <h1>{signup ? "Create your account" : "Sign in"}</h1>
        <p>
          {signup
            ? "Start with one desk and one language path."
            : "Continue where you left off."}
        </p>
        {error && (
          <div className="error-box">
            <Icon name="alert" />
            <span>{error}</span>
          </div>
        )}
        {signup && (
          <label>
            Name
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tên của bạn"
              autoComplete="name"
            />
          </label>
        )}
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
            autoComplete="email"
            required
          />
        </label>
        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="8+ characters"
            autoComplete={signup ? "new-password" : "current-password"}
            required
          />
        </label>
        <Button type="submit">{signup ? "Create account" : "Sign in"}</Button>
        <p className="switch">
          {signup ? "Already have an account?" : "New to Study Desk?"}{" "}
          <button
            type="button"
            onClick={() => {
              setSignup(!signup);
              setError(null);
            }}
          >
            {signup ? "Sign in" : "Create one"}
          </button>
        </p>
        <p className="switch" style={{ marginTop: 8, fontSize: 11 }}>
          Phase 1 local session (browser). Free stack — no paid auth required.
        </p>
      </form>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense
      fallback={
        <div className="auth-page">
          <div className="auth-panel">
            <h1>Loading…</h1>
          </div>
        </div>
      }
    >
      <AuthForm />
    </Suspense>
  );
}
