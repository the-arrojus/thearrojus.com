// src/pages/AdminTestimonials.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/auth";
import { db } from "../../lib/firebase";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";

function makeToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

function InviteRow({ invite, status }) {
  const link = `${window.location.origin}/t/${invite.token}`;
  const exp = invite.expiresAt instanceof Timestamp
    ? invite.expiresAt.toDate()
    : new Date(invite.expiresAt);

  return (
    <div className="rounded-xl border p-3 bg-white flex items-start justify-between gap-4">
      <div className="space-y-1 text-sm">
        <div className="font-medium">{invite.clientName}</div>
        <div className="text-gray-700">{invite.event}</div>
        <div className="font-mono break-all text-gray-600">{link}</div>
        <div className="text-xs text-gray-500">
          Expires: {exp.toLocaleString()}
        </div>
        {status === "expired" && (
          <div className="text-xs font-medium text-orange-600">Expired</div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span
          className={
            "rounded-full px-2 py-1 text-xs " +
            (status === "done"
              ? "bg-green-100 text-green-700"
              : status === "pending"
              ? "bg-yellow-100 text-yellow-700"
              : "bg-orange-100 text-orange-700")
          }
        >
          {status === "done" ? "Done" : status === "pending" ? "Pending" : "Expired"}
        </span>
        <button
          onClick={() => navigator.clipboard.writeText(link)}
          className="rounded-lg px-3 py-1.5 bg-gray-900 text-white text-xs"
        >
          Copy
        </button>
      </div>
    </div>
  );
}

export default function AdminTestimonials() {
  const { user, logout } = useAuth();

  const [eventName, setEventName] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  const [invites, setInvites] = useState([]); // raw invite docs
  const [statuses, setStatuses] = useState({}); // token -> "pending" | "done" | "expired"

  // Live list of invites for this admin
  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, "testimonialInvites"),
      where("adminUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      q,
      async (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setInvites(rows);

        // Compute statuses: check if testimonial/{token} exists OR expired
        const checks = await Promise.all(
          rows.map(async (r) => {
            const expMs =
              r.expiresAt instanceof Timestamp
                ? r.expiresAt.toMillis()
                : new Date(r.expiresAt).getTime();
            const isExpired = Date.now() >= expMs;
            try {
              const tDoc = await getDoc(doc(db, "testimonials", r.token));
              const isDone = tDoc.exists();
              return [r.token, isDone ? "done" : isExpired ? "expired" : "pending"];
            } catch {
              return [r.token, isExpired ? "expired" : "pending"];
            }
          })
        );
        setStatuses(Object.fromEntries(checks));
      },
      (e) => setErr(e?.message || "Failed to load invites")
    );
    return () => unsub();
  }, [user]);

  const createInvite = async (e) => {
    e.preventDefault();
    setErr(null);

    if (!eventName.trim()) {
      setErr("Event is required.");
      return;
    }
    if (!clientName.trim()) {
      setErr("Client full name is required.");
      return;
    }

    setBusy(true);
    try {
      const token = makeToken();
      const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

      await setDoc(doc(db, "testimonialInvites", token), {
        token,
        adminUid: user.uid,
        event: eventName.trim(),
        clientName: clientName.trim(),
        createdAt: serverTimestamp(),
        expiresAt,
      });

      setEventName("");
      setClientName("");
    } catch (e) {
      setErr(e?.message || "Failed to create invite");
    } finally {
      setBusy(false);
    }
  };

  const pending = useMemo(
    () => invites.filter((i) => statuses[i.token] === "pending"),
    [invites, statuses]
  );
  const done = useMemo(
    () => invites.filter((i) => statuses[i.token] === "done"),
    [invites, statuses]
  );

  return (
    <div className="p-6 space-y-8 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Testimonials — Admin</h1>
        <button onClick={logout} className="rounded-xl px-4 py-2 bg-gray-900 text-white shadow">
          Sign out
        </button>
      </div>

      {/* Create invite */}
      <form onSubmit={createInvite} className="space-y-4 rounded-2xl border p-4 bg-gray-50">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Event *</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={eventName}
            onChange={(e) => setEventName(e.target.value)}
            placeholder="e.g., Wedding of A & B"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Client Full Name *</label>
          <input
            className="w-full rounded-xl border px-3 py-2"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
            placeholder="Jane Doe"
            required
          />
        </div>
        {err && <div className="text-sm text-red-600">{err}</div>}
        <button
          type="submit"
          disabled={busy}
          className="rounded-xl px-4 py-2 bg-indigo-600 text-white shadow disabled:opacity-60"
        >
          {busy ? "Generating…" : "Generate 24-hour link"}
        </button>
      </form>

      {/* Pending */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Pending</h2>
        {pending.length === 0 ? (
          <div className="text-sm text-gray-500">No pending invites.</div>
        ) : (
          <div className="space-y-3">
            {pending.map((inv) => (
              <InviteRow key={inv.token} invite={inv} status="pending" />
            ))}
          </div>
        )}
      </section>

      {/* Done */}
      <section className="space-y-3">
        <h2 className="text-xl font-semibold">Done</h2>
        {done.length === 0 ? (
          <div className="text-sm text-gray-500">No completed testimonials yet.</div>
        ) : (
          <div className="space-y-3">
            {done.map((inv) => (
              <InviteRow key={inv.token} invite={inv} status="done" />
            ))}
          </div>
        )}
      </section>

      {/* Expired but unused (optional) */}
      <section className="space-y-3">
        <details className="rounded-xl border p-3 bg-gray-50">
          <summary className="cursor-pointer font-medium">Expired (no submission)</summary>
          <div className="mt-3 space-y-3">
            {invites
              .filter((i) => statuses[i.token] === "expired")
              .map((inv) => (
                <InviteRow key={inv.token} invite={inv} status="expired" />
              ))}
          </div>
        </details>
      </section>
    </div>
  );
}