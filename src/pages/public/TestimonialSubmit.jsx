import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../lib/firebase.js";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import FullScreenLoader from "../../components/FullScreenLoader";


function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1,2,3,4,5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n>1?"s":""}`}
          className={`text-2xl ${n <= value ? "text-yellow-500" : "text-gray-300"}`}
        >
          ★
        </button>
      ))}
    </div>
  );
}

export default function TestimonialSubmit() {
  const { token: rawToken } = useParams();
  const token = (rawToken || "").trim();

  const [loading, setLoading] = useState(true);
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);
  const [alreadyUsed, setAlreadyUsed] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const [stars, setStars] = useState(5);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const expired = useMemo(() => {
    if (!invite?.expiresAt) return true;
    try {
      const ms = invite.expiresAt instanceof Timestamp
        ? invite.expiresAt.toMillis()
        : new Date(invite.expiresAt).getTime();
      return Date.now() >= ms;
    } catch { return true; }
  }, [invite]);

  useEffect(() => {
    (async () => {
      if (!token) { setError("This link is invalid."); setLoading(false); return; }
      try {
        // Invite (public read)
        const invSnap = await getDoc(doc(db, "testimonialInvites", token));
        if (!invSnap.exists()) { setError("This link is invalid."); return; }
        setInvite(invSnap.data());

        // Check “already used” (if rules allow public get)
        try {
          const tSnap = await getDoc(doc(db, "testimonials", token));
          setAlreadyUsed(tSnap.exists());
        } catch {
          setAlreadyUsed(false); // private read: rely on submit-time rule
        }
      } catch (e) {
        console.error("Invite load error:", e);
        setError("Could not load invite.");
      } finally {
        setLoading(false);
      }
    })();
  }, [token]);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    if (submitting) return;

    if (expired || alreadyUsed) { setError("This link has already been used."); return; }

    const fullName = invite?.clientName?.trim();
    const event = invite?.event?.trim();
    if (!fullName || !event || !description.trim() || stars < 1 || stars > 5) {
      setError("Please add a rating (1–5) and description.");
      return;
    }

    try {
      setSubmitting(true);
      await setDoc(doc(db, "testimonials", token), {
        token, fullName, event, stars,
        description: description.trim(),
        submittedAt: serverTimestamp(),
      });
      setSubmitted(true);
      setAlreadyUsed(true);
    } catch (e) {
      console.error("Submission error:", e);
      setError("Submission failed. This link may have already been used.");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <FullScreenLoader label="Loading your invite…" />;

  if (error) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">{error}</h1>
        <p className="text-sm text-gray-600">Ask the sender for a new link if this persists.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-sm text-gray-600">Your testimonial has been recorded.</p>
      </div>
    );
  }

  if (alreadyUsed || expired) {
    return (
      <div className="p-6 space-y-2">
        <h1 className="text-2xl font-semibold">This link has already been used.</h1>
        <p className="text-sm text-gray-600">Please contact the sender for a new link.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Share your testimonial</h1>

      <form onSubmit={onSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Full name</label>
          <input className="w-full rounded-xl border px-3 py-2 bg-gray-100" value={invite?.clientName || ""} disabled />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Event</label>
          <input className="w-full rounded-xl border px-3 py-2 bg-gray-100" value={invite?.event || ""} disabled />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Rating</label>
          <StarInput value={stars} onChange={setStars} />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-900 mb-1">Description</label>
          <textarea
            className="w-full rounded-xl border px-3 py-2"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell us about your experience…"
            required
          />
        </div>

        <button type="submit" disabled={submitting}
          className="rounded-xl px-4 py-2 bg-indigo-600 text-white shadow disabled:opacity-60">
          {submitting ? "Submitting…" : "Submit"}
        </button>
      </form>
    </div>
  );
}