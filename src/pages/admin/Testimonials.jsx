// src/pages/AdminTestimonials.jsx
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../../context/auth";
import { db } from "../../lib/firebase";
import Button from "../../components/Button";
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
  const [copied, setCopied] = useState(false);

  const link = `${window.location.origin}/t/${invite.token}`;
  const exp =
    invite.expiresAt instanceof Timestamp
      ? invite.expiresAt.toDate()
      : new Date(invite.expiresAt);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    } catch {}
  };

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
          {status === "done"
            ? "Done"
            : status === "pending"
            ? "Pending"
            : "Expired"}
        </span>

        <Button
          onClick={handleCopy}
          size="sm"
          variant="outline"
          className="text-xs"
        >
          {copied ? "Copied!" : "Copy"}
        </Button>
      </div>
    </div>
  );
}

export default function AdminTestimonials() {
  const { user } = useAuth();
  const [eventName, setEventName] = useState("");
  const [clientName, setClientName] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [invites, setInvites] = useState([]);
  const [statuses, setStatuses] = useState({});

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
    if (!eventName.trim() || !clientName.trim()) {
      setErr("Event and Client name are required.");
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

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Testimonials</h1>
      </div>

      {/* --- Create Invite --- */}
      <form
        onSubmit={createInvite}
        className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3"
      >
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Create Invite</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Generate a 24-hour link for your client to submit their testimonial.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">Event *</label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Wedding of A & B"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">
              Client Full Name *
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" loading={busy} loadingText="Generating…">
              Generate 24-hour link
            </Button>
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>
        </div>
      </form>

      {/* --- Pending --- */}
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

      {/* --- Done --- */}
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

      {/* --- Expired --- */}
      <section className="space-y-3">
        <details className="rounded-xl border p-3 bg-gray-50">
          <summary className="cursor-pointer font-medium">
            Expired (no submission)
          </summary>
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
