// src/pages/AdminTestimonials.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "../../context/auth";
import { db, storage } from "../../lib/firebase";
import Button from "../../components/Button";
import AvatarCropper from "../../components/AvatarCropper";
import {
  collection, doc, getDoc, onSnapshot, orderBy, query,
  serverTimestamp, setDoc, Timestamp, where,
} from "firebase/firestore";
import { getDownloadURL, ref, uploadBytes, deleteObject } from "firebase/storage";
import { ChevronLeftIcon, ChevronRightIcon, CalendarDaysIcon, XMarkIcon } from "@heroicons/react/20/solid";

function makeToken() { return crypto.randomUUID().replace(/-/g, ""); }

/* ---------------- Calendar helpers ---------------- */
function fmtYmd(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}
function weekdayMon0(date) { return (date.getDay() + 6) % 7; } // Monday=0
function addDays(date, n) { const d = new Date(date); d.setDate(d.getDate() + n); return d; }
function getMonthGrid(viewYear, viewMonth, selectedYmd) {
  const todayYmd = fmtYmd(new Date());
  const first = new Date(viewYear, viewMonth, 1);
  const offset = weekdayMon0(first);
  const start = addDays(first, -offset);
  const days = [];
  for (let i = 0; i < 42; i++) {
    const d = addDays(start, i);
    const ymd = fmtYmd(d);
    days.push({
      date: ymd,
      isToday: ymd === todayYmd,
      isSelected: selectedYmd ? ymd === selectedYmd : false,
      isCurrentMonth: d.getMonth() === viewMonth,
    });
  }
  return days;
}

function InviteRow({ invite, status }) {
  const [copied, setCopied] = useState(false);
  const link = `${window.location.origin}/t/${invite.token}`;
  const exp = invite.expiresAt instanceof Timestamp ? invite.expiresAt.toDate() : new Date(invite.expiresAt);
  const handleCopy = async () => { try { await navigator.clipboard.writeText(link); setCopied(true); setTimeout(() => setCopied(false), 1200); } catch {} };

  return (
    <div className="rounded-xl border p-3 bg-white flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {invite.avatarUrl ? (
          <img src={invite.avatarUrl} alt={`${invite.clientName} avatar`} className="h-14 w-14 rounded-full object-cover border" loading="lazy" />
        ) : (
          <div className="h-14 w-14 rounded-full bg-gray-200 grid place-items-center text-sm text-gray-500">
            {invite.clientName?.[0] || "?"}
          </div>
        )}
        <div className="space-y-1 text-sm">
          <div className="font-medium">{invite.clientName}</div>
          <div className="text-gray-700">{invite.event}</div>
          {invite.eventPlace && <div className="text-gray-600">Place: {invite.eventPlace}</div>}
          {invite.eventDate && (
            <div className="text-gray-600">
              Date: {(invite.eventDate instanceof Timestamp ? invite.eventDate.toDate() : new Date(invite.eventDate)).toLocaleDateString()}
            </div>
          )}
          <div className="font-mono break-all text-gray-600">{link}</div>
          <div className="text-xs text-gray-500">Expires: {exp.toLocaleString()}</div>
          {status === "expired" && <div className="text-xs font-medium text-orange-600">Expired</div>}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className={
          "rounded-full px-2 py-1 text-xs " +
          (status === "done" ? "bg-green-100 text-green-700" :
           status === "pending" ? "bg-yellow-100 text-yellow-700" :
           "bg-orange-100 text-orange-700")
        }>
          {status === "done" ? "Done" : status === "pending" ? "Pending" : "Expired"}
        </span>
        <Button onClick={handleCopy} size="sm" variant="outline" className="text-xs">
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
  const [eventPlace, setEventPlace] = useState("");
  const [eventDate, setEventDate] = useState(""); // yyyy-mm-dd

  const [inviteToken, setInviteToken] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");
  const [rawAvatarFile, setRawAvatarFile] = useState(null);
  const [showCropper, setShowCropper] = useState(false);

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [invites, setInvites] = useState([]);
  const [statuses, setStatuses] = useState({});

  /* -------- Calendar popover state -------- */
  const [isCalOpen, setIsCalOpen] = useState(false);
  const calRef = useRef(null);
  const anchorRef = useRef(null);

  // Month view follows selected date (or today)
  const base = eventDate ? new Date(eventDate) : new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  const days = useMemo(() => getMonthGrid(viewYear, viewMonth, eventDate), [viewYear, viewMonth, eventDate]);

  const monthLabel = useMemo(
    () => new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, { month: "long", year: "numeric" }),
    [viewYear, viewMonth]
  );

  const openCalendar = () => {
    const d = eventDate ? new Date(eventDate) : new Date();
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setIsCalOpen(true);
  };
  const closeCalendar = () => setIsCalOpen(false);

  const goPrevMonth = () => {
    const d = new Date(viewYear, viewMonth - 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };
  const goNextMonth = () => {
    const d = new Date(viewYear, viewMonth + 1, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  // Close on outside click / Esc
  useEffect(() => {
    if (!isCalOpen) return;
    const onDocClick = (e) => {
      if (
        calRef.current && !calRef.current.contains(e.target) &&
        anchorRef.current && !anchorRef.current.contains(e.target)
      ) {
        closeCalendar();
      }
    };
    const onKey = (e) => { if (e.key === "Escape") closeCalendar(); };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isCalOpen]);

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
            const expMs = r.expiresAt instanceof Timestamp ? r.expiresAt.toMillis() : new Date(r.expiresAt).getTime();
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

  const ensureToken = () => {
    if (!inviteToken) { const t = makeToken(); setInviteToken(t); return t; }
    return inviteToken;
  };

  const handleChooseAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawAvatarFile(file);
    setShowCropper(true);
  };

  const uploadAvatarBlob = async (blob, token) => {
    const storageRef = ref(storage, `avatars/${token}/avatar.jpg`);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(storageRef);
    setAvatarUrl(url);
    return url;
  };

  const clearAvatar = async () => {
    try { if (!inviteToken) return; await deleteObject(ref(storage, `avatars/${inviteToken}/avatar.jpg`)); } catch {}
    setAvatarUrl(""); setRawAvatarFile(null); setShowCropper(false);
  };

  const createInvite = async (e) => {
    e.preventDefault();
    setErr(null);
    if (!eventName.trim() || !clientName.trim()) {
      setErr("Event and Client name are required."); return;
    }
    setBusy(true);
    try {
      const token = ensureToken();
      const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);
      const eventDateTs = eventDate ? Timestamp.fromDate(new Date(eventDate)) : null;

      await setDoc(doc(db, "testimonialInvites", token), {
        token, adminUid: user.uid, event: eventName.trim(), clientName: clientName.trim(),
        eventPlace: eventPlace.trim() || null, eventDate: eventDateTs, avatarUrl: avatarUrl || null,
        createdAt: serverTimestamp(), expiresAt,
      });

      setEventName(""); setClientName(""); setEventPlace(""); setEventDate("");
      setInviteToken(""); setAvatarUrl(""); setRawAvatarFile(null); setShowCropper(false);
      closeCalendar();
    } catch (e) {
      setErr(e?.message || "Failed to create invite");
    } finally {
      setBusy(false);
    }
  };

  const pending = useMemo(() => invites.filter((i) => statuses[i.token] === "pending"), [invites, statuses]);
  const done = useMemo(() => invites.filter((i) => statuses[i.token] === "done"), [invites, statuses]);

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Testimonials</h1>
      </div>

      {/* --- Create Invite --- */}
      <form onSubmit={createInvite} className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Create Invite</h2>
          <p className="mt-1 text-sm/6 text-gray-600">Generate a 24-hour link for your client to submit their testimonial.</p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">Event *</label>
            <input
              type="text" value={eventName} onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Wedding of A & B"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">Client Full Name *</label>
            <input
              type="text" value={clientName} onChange={(e) => setClientName(e.target.value)}
              placeholder="Jane Doe"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Event Date - Trigger & Full-Width Popover */}
          <div className="sm:col-span-3 relative">
            <label className="block text-sm/6 font-medium text-gray-900">Event Date</label>

            <div className="mt-2">
              <button
                ref={anchorRef}
                type="button"
                onClick={() => (isCalOpen ? closeCalendar() : openCalendar())}
                className="flex w-full items-center justify-between rounded-md border border-gray-300 bg-white px-3 py-2 text-left text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
                aria-haspopup="dialog"
                aria-expanded={isCalOpen}
              >
                <span className={eventDate ? "" : "text-gray-500"}>
                  {eventDate
                    ? new Date(eventDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })
                    : "Select date"}
                </span>
                <CalendarDaysIcon className="size-5 text-gray-400" aria-hidden="true" />
              </button>
            </div>

            {isCalOpen && (
              <div
                ref={calRef}
                role="dialog"
                aria-label="Choose date"
                className="absolute left-0 right-0 z-20 mt-2 w-full overflow-hidden rounded-2xl border bg-white shadow-xl"
              >
                <div className="p-4">
                  <div className="flex items-center">
                    <h3 className="flex-auto text-sm font-semibold text-gray-900">{monthLabel}</h3>
                    <button
                      type="button" onClick={goPrevMonth}
                      className="-my-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Previous month</span>
                      <ChevronLeftIcon aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button" onClick={goNextMonth}
                      className="-my-1.5 -mr-1.5 ml-2 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Next month</span>
                      <ChevronRightIcon aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button" onClick={closeCalendar}
                      className="ml-2 -my-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon aria-hidden="true" className="size-5" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-7 text-center text-xs/6 text-gray-500">
                    <div>M</div><div>T</div><div>W</div><div>T</div><div>F</div><div>S</div><div>S</div>
                  </div>

                  <div className="mt-2 grid grid-cols-7 text-sm">
                    {days.map((day, dayIdx) => (
                      <div
                        key={day.date}
                        data-first-line={dayIdx <= 6 ? "" : undefined}
                        className="py-2 not-data-first-line:border-t not-data-first-line:border-gray-200"
                      >
                        <button
                          type="button"
                          onClick={() => { setEventDate(day.date); closeCalendar(); }}
                          data-is-today={day.isToday ? "" : undefined}
                          data-is-selected={day.isSelected ? "" : undefined}
                          data-is-current-month={day.isCurrentMonth ? "" : undefined}
                          className="mx-auto flex size-8 items-center justify-center rounded-full not-data-is-selected:not-data-is-today:not-data-is-current-month:text-gray-400 not-data-is-selected:hover:bg-gray-200 not-data-is-selected:not-data-is-today:data-is-current-month:text-gray-900 data-is-selected:font-semibold data-is-selected:text-white data-is-selected:not-data-is-today:bg-gray-900 data-is-today:font-semibold not-data-is-selected:data-is-today:text-indigo-600 data-is-selected:data-is-today:bg-indigo-600"
                        >
                          <time dateTime={day.date}>{day.date.split("-").pop().replace(/^0/, "")}</time>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-gray-600">
                    <span>
                      {eventDate
                        ? `Selected: ${new Date(eventDate).toLocaleDateString(undefined, { year: "numeric", month: "long", day: "numeric" })}`
                        : "No date selected"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const ymd = fmtYmd(new Date());
                        setEventDate(ymd);
                        const d = new Date();
                        setViewYear(d.getFullYear());
                        setViewMonth(d.getMonth());
                      }}
                      className="rounded px-2 py-1 hover:bg-gray-100"
                    >
                      Today
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">Event Place</label>
            <input
              type="text" value={eventPlace} onChange={(e) => setEventPlace(e.target.value)}
              placeholder="Venue / City"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Avatar uploader */}
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">Client Avatar</label>
            <div className="mt-2 flex items-center gap-4">
              {avatarUrl ? (
                <img src={avatarUrl} alt="avatar preview" className="h-16 w-16 rounded-full object-cover border" />
              ) : (
                <div className="h-16 w-16 rounded-full bg-gray-200" />
              )}
              <div className="flex items-center gap-3">
                <input type="file" accept="image/*" onChange={handleChooseAvatar} />
                {avatarUrl && <Button type="button" variant="outline" onClick={clearAvatar}>Remove</Button>}
              </div>
            </div>
            <p className="mt-1 text-xs text-gray-500">Square crop is applied; images are public.</p>
          </div>

          <div className="col-span-full flex items-center gap-3">
            <Button type="submit" loading={busy} loadingText="Generating…">Generate 24-hour link</Button>
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
            {pending.map((inv) => <InviteRow key={inv.token} invite={inv} status="pending" />)}
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
            {done.map((inv) => <InviteRow key={inv.token} invite={inv} status="done" />)}
          </div>
        )}
      </section>

      {/* --- Expired --- */}
      <section className="space-y-3">
        <details className="rounded-xl border p-3 bg-gray-50">
          <summary className="cursor-pointer font-medium">Expired (no submission)</summary>
          <div className="mt-3 space-y-3">
            {invites.filter((i) => statuses[i.token] === "expired").map((inv) => (
              <InviteRow key={inv.token} invite={inv} status="expired" />
            ))}
          </div>
        </details>
      </section>

      {showCropper && rawAvatarFile && (
        <AvatarCropper
          file={rawAvatarFile}
          onCancel={() => { setShowCropper(false); setRawAvatarFile(null); }}
          onCropped={async (blob) => {
            const token = ensureToken();
            const url = await uploadAvatarBlob(blob, token);
            setShowCropper(false);
            setRawAvatarFile(null);
            setAvatarUrl(url);
          }}
        />
      )}
    </div>
  );
}
