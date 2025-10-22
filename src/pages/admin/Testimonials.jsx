import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion"; // animations
import { useAuth } from "../../context/auth";
import { db, storage } from "../../lib/firebase";
import Button from "../../components/Button";
import AvatarCropper from "../../components/AvatarCropper";
import { useToast } from "../../components/ToastProvider";
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
import {
  getDownloadURL,
  ref,
  uploadBytes,
  deleteObject,
} from "firebase/storage";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CalendarDaysIcon,
  XMarkIcon,
  ChevronDownIcon,
  ClockIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  MapPinIcon,
  XCircleIcon
} from "@heroicons/react/20/solid";
import { UserCircleIcon } from "@heroicons/react/24/solid";

// California cities list (keep sorted for best UX)
import CA_CITIES from "../../data/ca_cities";

function makeToken() {
  return crypto.randomUUID().replace(/-/g, "");
}

/* ---------------- Calendar helpers ---------------- */
function fmtYmd(date) {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, "0");
  const d = `${date.getDate()}`.padStart(2, "0");
  return `${y}-${m}-${d}`;
}

/** Parse 'YYYY-MM-DD' as a LOCAL date (avoid UTC off-by-one) */
function parseYmdLocal(ymd) {
  const [y, m, d] = ymd.split("-").map((s) => parseInt(s, 10));
  return new Date(y, m - 1, d, 0, 0, 0, 0);
}

function weekdayMon0(date) {
  return (date.getDay() + 6) % 7; // Monday=0
}
function addDays(date, n) {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}
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

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

/* ---------- Framer Motion button wrapper (like MotionLink) ---------- */
const MotionButton = motion.button;

/* ---------------- InviteRow (Card UI) ---------------- */
function InviteRow({ invite, status, onToast }) {
  const [copied, setCopied] = useState(false);
  const [visible, setVisible] = useState(false);
  const [expiryText, setExpiryText] = useState("");
  const cardRef = useRef(null);
  const link = `${window.location.origin}/t/${invite.token}`;

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setVisible(true),
      { threshold: 0.16 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  
  useEffect(() => {
    const updateExpiry = () => {
      const now = Date.now();
      const expiryMs = invite.expiresAt?.seconds * 1000 + (invite.expiresAt?.nanoseconds || 0) / 1e6;
      const diffMs = expiryMs - now;
      const diffHr = Math.floor(diffMs / (1000 * 60 * 60));
      if (diffHr <= 0) {
        setExpiryText("Expired");
      } else {
        setExpiryText(`${diffHr}Hr`);
      }
    };

    updateExpiry();
    const interval = setInterval(updateExpiry, 60000); // update every minute
    return () => clearInterval(interval);
  }, [invite.expiresAt]);
  
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      onToast?.("Link copied to clipboard");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      onToast?.("Failed to copy link", "error");
    }
  };

  const handleOpenMap = () => {
    if (!invite.eventPlace) return;
    const query = encodeURIComponent(invite.eventPlace);
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, "_blank");
  };
  
  console.log(invite);
  
  return (
    <div
      ref={cardRef}
      className={classNames(
        "group relative col-span-1 divide-y divide-gray-100 rounded-xl bg-white shadow-lg border border-gray-200",
        "transition-all duration-300 ease-out will-change-transform",
        "hover:shadow-2xl hover:-translate-y-0.5 hover:rotate-[0.15deg]",
        "focus-within:shadow-2xl focus-within:-translate-y-0.5",
        visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-3"
      )}
      onMouseMove={(e) => {
        const r = cardRef.current?.getBoundingClientRect();
        if (!r) return;
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        cardRef.current.style.setProperty("--tiltX", `${py * -2}deg`);
        cardRef.current.style.setProperty("--tiltY", `${px * 2}deg`);
      }}
      onMouseLeave={() => {
        if (cardRef.current) {
          cardRef.current.style.setProperty("--tiltX", `0deg`);
          cardRef.current.style.setProperty("--tiltY", `0deg`);
        }
      }}
      style={{
        transform:
          "translateZ(0) perspective(1000px) rotateX(var(--tiltX, 0deg)) rotateY(var(--tiltY, 0deg))"
      }}
    >
      {/* Top section */}
      <div className="flex w-full items-center justify-between space-x-6 p-6">
        <div className="flex-1 truncate">
          <div className="flex items-center space-x-3">
            <h3 className="truncate text-sm font-medium text-gray-900">
              {invite.clientName || "Unknown Client"}
            </h3>
            {
              expiryText !== "Expired" ?
                (
                  <span className="inline-flex shrink-0 items-center rounded-full bg-green-50 px-1.5 py-0.5 text-xs font-medium text-green-700 inset-ring inset-ring-green-600/20">
                    {expiryText}
                  </span>
                )
                : ""
            }
          </div>
          
          <p className="mt-1 truncate text-sm text-gray-500">
            {invite.event || "Untitled Event"}
          </p>
        </div>

        {invite.avatarUrl ? (
          <img
            alt={`${invite.clientName || "Client"} avatar`}
            src={invite.avatarUrl}
            className="size-12 shrink-0 rounded-full object-cover bg-gray-300 ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-150"
            loading="lazy"
          />
        ) : (
          <div className="size-12 shrink-0 rounded-full bg-gray-200 grid place-items-center text-sm text-gray-600 outline -outline-offset-1 outline-black/5 ring-1 ring-black/5 transition-transform duration-500 group-hover:scale-150">
            {invite.clientName?.[0] || "?"}
          </div>
        )}
      </div>

      {/* Bottom row */}
      <div>
        <div className="-mt-px flex divide-x divide-gray-200">
          {/* Location button */}
          <div className="flex w-0 flex-1">
            <button
              type="button"
              onClick={handleOpenMap}
              disabled={!invite.eventPlace}
              className={classNames(
                "group/location relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-2 rounded-bl-xl border border-transparent py-3 text-sm font-semibold transition-all duration-200",
                invite.eventPlace
                  ? "text-gray-900 hover:bg-gray-50 active:scale-[0.99]"
                  : "cursor-not-allowed text-gray-400"
              )}
            >
              <MapPinIcon
                aria-hidden="true"
                className="size-5 text-gray-400 transition-transform duration-200 group-hover:translate-y-[-1px]"
              />
              <span className="truncate">{invite.eventPlace || "Location not set"}</span>

              {invite.eventPlace && (
                <span className="pointer-events-none absolute inset-x-6 bottom-2 h-px bg-gradient-to-r from-transparent via-gray-400 to-transparent transform scale-x-0 origin-center transition-transform duration-300 group-hover/location:scale-x-100" />
              )}
            </button>
          </div>

          {/* Right side */}
          <div className="-ml-px flex w-0 flex-1 relative">
            {status === "expired" ? (
              <div className="inline-flex w-0 flex-1 items-center justify-center gap-2 rounded-br-xl border border-transparent py-3 text-sm font-semibold text-red-700 bg-red-50 cursor-not-allowed select-none">
                <XCircleIcon className="size-5 text-red-600" aria-hidden="true" />
                Expired
              </div>
            ) : status === "done" ? (
              <div className="inline-flex w-0 flex-1 items-center justify-center gap-2 rounded-br-xl border border-transparent py-3 text-sm font-semibold text-green-700 bg-green-50 select-none">
                <CheckCircleIcon className="size-5 text-green-600" aria-hidden="true" />
                Completed
              </div>
            ) : (
              <>
                {copied && (
                  <span
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 rounded-br-xl bg-green-300/30 animate-ping"
                  />
                )}

                <button
                  type="button"
                  onClick={handleCopy}
                  className={classNames(
                    "group/copy relative inline-flex w-0 flex-1 items-center justify-center gap-x-2 rounded-br-xl border border-transparent py-3 text-sm font-semibold transition-all duration-200 focus:outline-none",
                    "hover:bg-gray-50 active:scale-[0.99]",
                    copied
                      ? "bg-green-50 text-green-700 ring-1 ring-green-200 translate-y-[-1px]"
                      : "text-gray-900"
                  )}
                  aria-live="polite"
                >
                  {copied ? (
                    <svg
                      aria-hidden="true"
                      className="size-5 text-green-500 transition-transform duration-300 scale-110 rotate-[8deg]"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm4.28 7.22a1 1 0 0 1 0 1.41l-5 5a1 1 0 0 1-1.41 0l-2-2a1 1 0 1 1 1.41-1.41l1.29 1.29 4.3-4.3a1 1 0 0 1 1.41 0Z" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      className="size-5 text-gray-400 transition-transform duration-200"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M7 7a3 3 0 0 1 3-3h7a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3v-7Zm3-1a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1H7Z" />
                    </svg>
                  )}

                  <span className={classNames("transition-transform", copied ? "animate-pulse" : "")}>
                    {copied ? "Copied!" : "Copy Link"}
                  </span>

                  <span
                    className={classNames(
                      "pointer-events-none absolute inset-x-6 bottom-2 h-px transform scale-x-0 origin-center transition-transform duration-300 group-hover/copy:scale-x-100",
                      copied
                        ? "bg-gradient-to-r from-transparent via-green-500 to-transparent"
                        : "bg-gradient-to-r from-transparent via-gray-400 to-transparent"
                    )}
                  />

                  {copied && (
                    <span
                      aria-hidden="true"
                      className="absolute -top-1 right-6 text-green-500 animate-bounce"
                    >
                      <svg viewBox="0 0 24 24" className="size-4" fill="currentColor">
                        <path d="M12 2l1.8 4.2L18 8l-4.2 1.8L12 14l-1.8-4.2L6 8l4.2-1.8L12 2z" />
                      </svg>
                    </span>
                  )}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}


/* ---------------- Main Component ---------------- */
export default function AdminTestimonials() {
  const { user } = useAuth();
  const { showToast } = useToast();

  const [eventName, setEventName] = useState("");
  const [clientName, setClientName] = useState("");
  const [eventPlace, setEventPlace] = useState(""); // ghost autocomplete
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

  // Hidden file input for avatar "Change" button
  const avatarInputRef = useRef(null);

  // Input ref for Event Place (needed to keep focus / caret on Tab-accept)
  const eventPlaceInputRef = useRef(null);

  // Month view follows selected date (or today)
  const base = eventDate ? parseYmdLocal(eventDate) : new Date();
  const [viewYear, setViewYear] = useState(base.getFullYear());
  const [viewMonth, setViewMonth] = useState(base.getMonth());

  const days = useMemo(
    () => getMonthGrid(viewYear, viewMonth, eventDate),
    [viewYear, viewMonth, eventDate]
  );

  const monthLabel = useMemo(
    () =>
      new Date(viewYear, viewMonth, 1).toLocaleDateString(undefined, {
        month: "long",
        year: "numeric",
      }),
    [viewYear, viewMonth]
  );

  const openCalendar = () => {
    const d = eventDate ? parseYmdLocal(eventDate) : new Date();
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

  // Center the calendar when it opens
  useEffect(() => {
    if (isCalOpen && calRef.current) {
      calRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [isCalOpen]);

  // Close on outside click / Esc
  useEffect(() => {
    if (!isCalOpen) return;
    const onDocClick = (e) => {
      if (
        calRef.current &&
        !calRef.current.contains(e.target) &&
        anchorRef.current &&
        !anchorRef.current.contains(e.target)
      ) {
        closeCalendar();
      }
    };
    const onKey = (e) => {
      if (e.key === "Escape") closeCalendar();
    };
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [isCalOpen]);

  // Live invites + statuses
  useEffect(() => {
    if (!user) return;
    const qry = query(
      collection(db, "testimonialInvites"),
      where("adminUid", "==", user.uid),
      orderBy("createdAt", "desc")
    );
    const unsub = onSnapshot(
      qry,
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
      (e) => {
        setErr(e?.message || "Failed to load invites");
        showToast(e?.message || "Failed to load invites", "error");
      }
    );
    return unsub;
  }, [user, showToast]);

  const ensureToken = () => {
    if (!inviteToken) {
      const t = makeToken();
      setInviteToken(t);
      return t;
    }
    return inviteToken;
  };

  const handleChooseAvatar = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRawAvatarFile(file);
    setShowCropper(true);
    // reset the input so selecting the same file again re-triggers onChange
    e.target.value = "";
  };

  const uploadAvatarBlob = async (blob, token) => {
    const storageRef = ref(storage, `avatars/${token}/avatar.jpg`);
    await uploadBytes(storageRef, blob, { contentType: "image/jpeg" });
    const url = await getDownloadURL(storageRef);
    setAvatarUrl(url);
    return url;
  };

  const clearAvatar = async () => {
    try {
      if (!inviteToken) return;
      await deleteObject(ref(storage, `avatars/${inviteToken}/avatar.jpg`));
      showToast("Photo removed");
    } catch {
      showToast("Failed to remove photo", "error");
    }
    setAvatarUrl("");
    setRawAvatarFile(null);
    setShowCropper(false);
  };

  /* -------- Ghost autocomplete (Event Place) -------- */
  const suggestion = useMemo(() => {
    const qRaw = eventPlace;
    if (!qRaw) return "";
    const q = qRaw.toLowerCase();
    return CA_CITIES.find((c) => c.toLowerCase().startsWith(q)) || "";
  }, [eventPlace]);

  const hasAutoComplete = useMemo(() => {
    if (!eventPlace || !suggestion) return false;
    const val = eventPlace.toLowerCase();
    const s = suggestion.toLowerCase();
    return s.startsWith(val) && s.length > val.length;
  }, [eventPlace, suggestion]);

  const handleEventPlaceKeyDown = (e) => {
    if (e.key === "Tab") {
      if (hasAutoComplete) {
        e.preventDefault();
        const full = suggestion;
        setEventPlace(full);
        requestAnimationFrame(() => {
          const el = eventPlaceInputRef.current;
          if (el) {
            const end = full.length;
            el.setSelectionRange(end, end);
          }
        });
      }
    }
  };
  /* ----------------------------------------------- */

  const createInvite = async (e) => {
    e.preventDefault();
    setErr(null);

    // Required fields
    if (!eventName.trim() || !clientName.trim()) {
      const msg = "Event and Client name are required.";
      setErr(msg);
      showToast(msg, "error");
      return;
    }
    if (!avatarUrl) {
      const msg = "Client avatar is required.";
      setErr(msg);
      showToast(msg, "error");
      return;
    }

    setBusy(true);
    try {
      const token = ensureToken();
      const expiresAt = Timestamp.fromMillis(Date.now() + 24 * 60 * 60 * 1000);

      // Parse YYYY-MM-DD as LOCAL date to avoid off-by-one
      const eventDateTs = eventDate ? Timestamp.fromDate(parseYmdLocal(eventDate)) : null;

      await setDoc(doc(db, "testimonialInvites", token), {
        token,
        adminUid: user.uid,
        event: eventName.trim(),
        clientName: clientName.trim(),
        eventPlace: eventPlace.trim() || null,
        eventDate: eventDateTs,
        avatarUrl, // mandatory
        createdAt: serverTimestamp(),
        expiresAt,
      });

      setEventName("");
      setClientName("");
      setEventPlace("");
      setEventDate("");
      setInviteToken("");
      setAvatarUrl("");
      setRawAvatarFile(null);
      setShowCropper(false);

      showToast("Invite created. Link expires in 24 hours.");
    } catch (e2) {
      setErr(e2?.message || "Failed to create invite");
      showToast(e2?.message || "Failed to create invite", "error");
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
  const expired = useMemo(
    () => invites.filter((i) => statuses[i.token] === "expired"),
    [invites, statuses]
  );

  // Tabs: 'pending' | 'done' | 'expired'
  const [activeTab, setActiveTab] = useState("pending");

  // Respect OS reduced-motion setting — mirrors AdminHeader behavior
  const prefersReducedMotion = useReducedMotion();
  const hoverScale = prefersReducedMotion ? 1 : 1.05;
  const tapScale = prefersReducedMotion ? 1 : 0.97;

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Testimonials</h1>
      </div>

      {/* --- Create Invite --- */}
      <form
        onSubmit={createInvite}
        className="grid grid-cols-1 gap-x-8 gap-y-10 pb-12 md:grid-cols-3"
      >
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Create Invite</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Generate a 24-hour link for your client to submit their testimonial.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          {/* Avatar uploader — REQUIRED */}
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">
              Photo <span className="text-red-600">*</span>
            </label>
            <div className="mt-2 flex items-center gap-x-3">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt="avatar preview"
                  className="size-12 rounded-full object-cover border"
                />
              ) : (
                <UserCircleIcon aria-hidden="true" className="size-12 text-gray-300" />
              )}

              {/* Hidden input triggered by the Change button */}
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handleChooseAvatar}
                aria-required="true"
              />

              <button
                type="button"
                onClick={() => avatarInputRef.current?.click()}
                className="rounded-md bg-white px-3 py-2 text-sm font-semibold text-gray-900 shadow-xs inset-ring inset-ring-gray-300 hover:bg-gray-50"
              >
                Change
              </button>

              {avatarUrl && (
                <button
                  type="button"
                  onClick={clearAvatar}
                  className="text-sm text-gray-700 underline"
                >
                  Remove
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Square crop is applied; images are public.
            </p>
          </div>

          {/* Event */}
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">
              Event <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., Wedding of Sandeep & Amulya"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Client Name */}
          <div className="sm:col-span-6">
            <label className="block text-sm/6 font-medium text-gray-900">
              Client Full Name <span className="text-red-600">*</span>
            </label>
            <input
              type="text"
              value={clientName}
              onChange={(e) => setClientName(e.target.value)}
              placeholder="Amulya Vagala"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
            />
          </div>

          {/* Event Date - Trigger & Full-Width Popover */}
          <div className="sm:col-span-3 relative">
            <label className="block text-sm/6 font-medium text-gray-900">
              Event Date
            </label>

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
                    ? parseYmdLocal(eventDate).toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })
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
                    <h3 className="flex-auto text-sm font-semibold text-gray-900">
                      {monthLabel}
                    </h3>
                    <button
                      type="button"
                      onClick={goPrevMonth}
                      className="-my-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Previous month</span>
                      <ChevronLeftIcon aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={goNextMonth}
                      className="-my-1.5 -mr-1.5 ml-2 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Next month</span>
                      <ChevronRightIcon aria-hidden="true" className="size-5" />
                    </button>
                    <button
                      type="button"
                      onClick={closeCalendar}
                      className="ml-2 -my-1.5 flex flex-none items-center justify-center p-1.5 text-gray-400 hover:text-gray-500"
                    >
                      <span className="sr-only">Close</span>
                      <XMarkIcon aria-hidden="true" className="size-5" />
                    </button>
                  </div>

                  <div className="mt-6 grid grid-cols-7 text-center text-xs/6 text-gray-500">
                    <div>M</div>
                    <div>T</div>
                    <div>W</div>
                    <div>T</div>
                    <div>F</div>
                    <div>S</div>
                    <div>S</div>
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
                          onClick={() => {
                            setEventDate(day.date);
                            closeCalendar();
                          }}
                          data-is-today={day.isToday ? "" : undefined}
                          data-is-selected={day.isSelected ? "" : undefined}
                          data-is-current-month={day.isCurrentMonth ? "" : undefined}
                          className="mx-auto flex size-8 items-center justify-center rounded-full not-data-is-selected:not-data-is-today:not-data-is-current-month:text-gray-400 not-data-is-selected:hover:bg-gray-200 not-data-is-selected:not-data-is-today:data-is-current-month:text-gray-900 data-is-selected:font-semibold data-is-selected:text-white data-is-selected:not-data-is-today:bg-gray-900 data-is-today:font-semibold not-data-is-selected:data-is-today:text-indigo-600 data-is-selected:data-is-today:bg-indigo-600"
                        >
                          <time dateTime={day.date}>
                            {day.date.split("-").pop().replace(/^0/, "")}
                          </time>
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex items-center justify-between border-t pt-3 text-xs text-gray-600">
                    <span>
                      {eventDate
                        ? `Selected: ${parseYmdLocal(eventDate).toLocaleDateString(undefined, {
                            year: "numeric",
                            month: "long",
                            day: "numeric",
                          })}`
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

          {/* Event Place with ghost autocomplete + Tab hint */}
          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">
              Event Place
            </label>

            <div className="relative mt-2">
              {/* Ghost suggestion overlay */}
              <div
                aria-hidden="true"
                className={`pointer-events-none absolute left-3 ${
                  hasAutoComplete ? "right-28" : "right-3"
                } top-0 bottom-0 flex items-center text-base`}
              >
                <span className="invisible whitespace-pre">{eventPlace}</span>
                {hasAutoComplete && (
                  <span className="text-gray-400 whitespace-pre">
                    {suggestion.slice(eventPlace.length)}
                  </span>
                )}
              </div>

              {/* Right-side hint */}
              {hasAutoComplete && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 hidden sm:flex items-center gap-1 text-xs text-gray-400"
                >
                  <span>Press</span>
                  <kbd className="rounded border border-gray-300 px-1 py-0.5">Tab</kbd>
                  <span>to autocomplete</span>
                </div>
              )}

              {/* Actual input */}
              <input
                ref={eventPlaceInputRef}
                type="text"
                value={eventPlace}
                onChange={(e) => setEventPlace(e.target.value)}
                onKeyDown={handleEventPlaceKeyDown}
                placeholder="e.g., San Francisco"
                autoComplete="off"
                className="block w-full rounded-md border border-gray-300 bg-transparent px-3 py-1.5 text-base text-gray-900 outline-none focus:ring-2 focus:ring-indigo-600"
              />
            </div>

            <p className="mt-1 text-xs text-gray-500 sm:hidden">Press Tab to autocomplete.</p>
          </div>

          <div className="col-span-full flex items-center gap-3">
            <Button
              type="submit"
              loading={busy}
              loadingText="Generating…"
              disabled={!avatarUrl || busy}
              title={!avatarUrl ? "Please add a client avatar first" : undefined}
            >
              Generate 24-hour link
            </Button>
            {err && <div className="text-sm text-red-600">{err}</div>}
          </div>
        </div>
      </form>

      {/* --- Tabs (Pending / Done / Expired) --- */}
      <section className="space-y-4">
        {/* Responsive tabs header */}
        <div>
          {/* Mobile: select */}
          <div className="grid grid-cols-1 sm:hidden">
            <select
              value={activeTab}
              onChange={(e) => setActiveTab(e.target.value)}
              aria-label="Select a tab"
              className="col-start-1 row-start-1 w-full appearance-none rounded-md bg-white py-2 pr-8 pl-3 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600"
            >
              <option value="pending">Pending</option>
              <option value="done">Done</option>
              <option value="expired">Expired</option>
            </select>
            <ChevronDownIcon
              aria-hidden="true"
              className="pointer-events-none col-start-1 row-start-1 mr-2 size-5 self-center justify-self-end fill-gray-500"
            />
          </div>

          {/* Desktop: tabs with icons (animated like AdminHeader) */}
          <div className="hidden sm:block">
            <nav
              aria-label="Tabs"
              className="isolate flex divide-x divide-gray-200 rounded-lg bg-white shadow-sm"
            >
              {[
                { key: "pending", name: "Pending", icon: ClockIcon },
                { key: "done", name: "Done", icon: CheckCircleIcon },
                { key: "expired", name: "Expired", icon: ExclamationTriangleIcon },
              ].map((tab, idx) => {
                const current = activeTab === tab.key;
                const Icon = tab.icon;
                return (
                  <MotionButton
                    key={tab.key}
                    type="button"
                    onClick={() => setActiveTab(tab.key)}
                    aria-current={current ? "page" : undefined}
                    whileHover={{ scale: hoverScale }}
                    whileTap={{ scale: tapScale }}
                    transition={{ type: "spring", stiffness: 350, damping: 22 }}
                    className={classNames(
                      current ? "text-gray-900" : "text-gray-500 hover:text-gray-700",
                      idx === 0 ? "rounded-l-lg" : "",
                      idx === 2 ? "rounded-r-lg" : "",
                      "group relative min-w-0 flex-1 overflow-hidden px-4 py-4 text-center text-sm font-medium hover:bg-gray-50 focus:z-10"
                    )}
                  >
                    <span className="inline-flex items-center justify-center gap-2">
                      <Icon
                        aria-hidden="true"
                        className={classNames(
                          "size-5",
                          current ? "text-indigo-600" : "text-gray-400 group-hover:text-gray-500"
                        )}
                      />
                      <span>{tab.name}</span>
                    </span>
                    <span
                      aria-hidden="true"
                      className={classNames(
                        current ? "bg-indigo-500" : "bg-transparent",
                        "absolute inset-x-0 bottom-0 h-0.5"
                      )}
                    />
                  </MotionButton>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Tab Panels */}
        {activeTab === "pending" && (
          <div className="space-y-3">
            {pending.length === 0 ? (
              <div className="text-sm text-gray-500">No pending invites.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {pending.map((inv) => (
                  <InviteRow key={inv.token} invite={inv} status="pending" onToast={showToast} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "done" && (
          <div className="space-y-3">
            {done.length === 0 ? (
              <div className="text-sm text-gray-500">No completed testimonials yet.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {done.map((inv) => (
                  <InviteRow key={inv.token} invite={inv} status="done" onToast={showToast} />
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === "expired" && (
          <div className="space-y-3">
            {expired.length === 0 ? (
              <div className="text-sm text-gray-500">No expired invites.</div>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {expired.map((inv) => (
                  <InviteRow key={inv.token} invite={inv} status="expired" onToast={showToast} />
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {showCropper && rawAvatarFile && (
        <AvatarCropper
          file={rawAvatarFile}
          onCancel={() => {
            setShowCropper(false);
            setRawAvatarFile(null);
          }}
          onCropped={async (blob) => {
            try {
              const token = ensureToken();
              const url = await uploadAvatarBlob(blob, token);
              setShowCropper(false);
              setRawAvatarFile(null);
              setAvatarUrl(url);
              showToast("Photo updated");
            } catch {
              showToast("Failed to upload photo", "error");
            }
          }}
        />
      )}
    </div>
  );
}
