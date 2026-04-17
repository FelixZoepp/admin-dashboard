"use client";

import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const sb = supabaseBrowser();
    const { error } = await sb.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setBusy(false);
    setMsg(
      error
        ? `Fehler: ${error.message}`
        : "Check deinen Posteingang für den Magic Link.",
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-sm bg-bg-secondary border border-border rounded-xl p-6 shadow-card"
      >
        <h1 className="text-lg font-bold mb-1">Content Leads Admin</h1>
        <p className="text-xs text-muted mb-5">
          Login per Magic Link — nur für freigeschaltete Email-Adressen.
        </p>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="dein@email.de"
          className="w-full bg-bg-primary border border-border rounded px-3 py-2 text-sm mb-3"
        />
        <button
          disabled={busy}
          className="w-full bg-accent-blue text-white font-semibold rounded py-2 text-sm disabled:opacity-50"
        >
          {busy ? "Sende Link…" : "Magic Link senden"}
        </button>
        {msg && <p className="text-xs text-muted mt-3">{msg}</p>}
      </form>
    </main>
  );
}
