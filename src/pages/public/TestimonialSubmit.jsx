import { useEffect, useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { db } from "../../lib/firebase.js";
import { doc, getDoc, setDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import FullScreenLoader from "../../components/FullScreenLoader";

function StarInput({ value, onChange }) {
  return (
    <div className="flex gap-2">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? "s" : ""}`}
          className={`text-2xl leading-none ${n <= value ? "text-yellow-500" : "text-gray-300"}`}
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
      const ms =
        invite.expiresAt instanceof Timestamp
          ? invite.expiresAt.toMillis()
          : new Date(invite.expiresAt).getTime();
      return Date.now() >= ms;
    } catch {
      return true;
    }
  }, [invite]);

  useEffect(() => {
    (async () => {
      if (!token) {
        setError("This link is invalid.");
        setLoading(false);
        return;
      }
      try {
        const invSnap = await getDoc(doc(db, "testimonialInvites", token));
        if (!invSnap.exists()) {
          setError("This link is invalid.");
          return;
        }
        setInvite(invSnap.data());

        try {
          const tSnap = await getDoc(doc(db, "testimonials", token));
          setAlreadyUsed(tSnap.exists());
        } catch {
          setAlreadyUsed(false);
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

    if (expired || alreadyUsed) {
      setError("This link has already been used.");
      return;
    }

    const fullName = invite?.clientName?.trim();
    const event = invite?.event?.trim();
    if (!fullName || !event || !description.trim() || stars < 1 || stars > 5) {
      setError("Please add a rating (1–5) and description.");
      return;
    }

    try {
      setSubmitting(true);
      await setDoc(doc(db, "testimonials", token), {
        token,
        fullName,
        event,
        stars,
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
      <div className="max-w-4xl mx-auto p-6 space-y-2">
        <h1 className="text-2xl font-semibold">{error}</h1>
        <p className="text-sm text-gray-600">Ask the sender for a new link if this persists.</p>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-2">
        <h1 className="text-2xl font-semibold">Thank you!</h1>
        <p className="text-sm text-gray-600">Your testimonial has been recorded.</p>
      </div>
    );
  }

  if (alreadyUsed || expired) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-2">
        <h1 className="text-2xl font-semibold">This link has already been used.</h1>
        <p className="text-sm text-gray-600">Please contact the sender for a new link.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-10">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Share your testimonial</h1>
      </div>

      {/* --- Your Details --- */}
      <section className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Your Details</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            These details are from your invitation and cannot be edited.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-3">
            <label htmlFor="full-name" className="block text-sm/6 font-medium text-gray-900">
              Full name
            </label>
            <div className="mt-2">
              <input
                id="full-name"
                className="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300"
                value={invite?.clientName || ""}
                disabled
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="event" className="block text-sm/6 font-medium text-gray-900">
              Event
            </label>
            <div className="mt-2">
              <input
                id="event"
                className="block w-full rounded-md bg-gray-100 px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300"
                value={invite?.event || ""}
                disabled
              />
            </div>
          </div>
        </div>
      </section>

      {/* --- Your Review --- */}
      <form
        onSubmit={onSubmit}
        className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3"
      >
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Your Review</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Please rate your experience and share your thoughts.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-6">
            <label htmlFor="rating" className="block text-sm/6 font-medium text-gray-900">
              Rating
            </label>
            <div className="mt-2">
              <StarInput value={stars} onChange={setStars} />
            </div>
            <p className="mt-1 text-xs text-gray-500">1 = poor, 5 = excellent</p>
          </div>

          <div className="sm:col-span-6">
            <label htmlFor="description" className="block text-sm/6 font-medium text-gray-900">
              Description
            </label>
            <div className="mt-2">
              <textarea
                id="description"
                rows={4}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Tell us about your experience…"
                required
                className="block w-full rounded-md bg-white px-3 py-2 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600"
              />
            </div>
          </div>

          {/* Action Row */}
          <div className="col-span-full flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl px-4 py-2 bg-indigo-600 text-white shadow disabled:opacity-60"
            >
              {submitting ? "Submitting…" : "Submit"}
            </button>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        </div>
      </form>
    </div>
  );
}
