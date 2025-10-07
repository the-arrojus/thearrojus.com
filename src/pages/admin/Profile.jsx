import { useEffect, useState, useMemo } from "react";
import { useAuth } from "../../context/auth";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  sendEmailVerification,
} from "firebase/auth";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

export default function Profile() {
  const { user, logout } = useAuth();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [region, setRegion] = useState("");
  const [postal, setPostal] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);

  const addrKey = useMemo(() => (user ? `profile_addr_${user.uid}` : null), [user]);

  useEffect(() => {
    if (!user) return;
    const displayName = user.displayName || "";
    const [fn, ...rest] = displayName.split(" ").filter(Boolean);
    setFirstName(fn || "");
    setLastName(rest.join(" ") || "");
    setEmail(user.email || "");

    try {
      const raw = addrKey && localStorage.getItem(addrKey);
      if (raw) {
        const a = JSON.parse(raw);
        setStreet(a.street ?? "");
        setCity(a.city ?? "");
        setRegion(a.region ?? "");
        setPostal(a.postal ?? "");
      }
    } catch {}
  }, [user, addrKey]);

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      const displayName = [firstName, lastName].join(" ").trim() || null;
      await updateProfile(user, { displayName });

      if (email && email !== user.email) {
        await updateEmail(user, email);
      }

      await user.reload();

      const payload = { street, city, region, postal };
      try {
        if (addrKey) localStorage.setItem(addrKey, JSON.stringify(payload));
      } catch {}

      setNote("Profile updated.");
    } catch (e) {
      setErr(e?.message || "Failed to update profile.");
    } finally {
      setBusy(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!user) return;
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      if (!newPassword || newPassword.length < 6) {
        throw new Error("Password must be at least 6 characters.");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Passwords do not match.");
      }

      await updatePassword(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      setNote("Password updated.");
    } catch (e) {
      if (e?.code === "auth/requires-recent-login") {
        setErr("Please re-login and try updating your password again.");
      } else {
        setErr(e?.message || "Failed to update password.");
      }
    } finally {
      setBusy(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!user) return;
    setErr(null);
    setNote(null);
    setBusy(true);
    try {
      await sendEmailVerification(user);
      setNote("Verification email sent. Please check your inbox.");
    } catch (e) {
      setErr(e?.message || "Failed to send verification email.");
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <button onClick={logout} className="rounded-xl px-4 py-2 bg-gray-900 text-white shadow">
          Sign out
        </button>
      </div>

      {/* --- Personal Information --- */}
      <form
        onSubmit={saveProfile}
        className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3"
      >
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Personal Information</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Use a permanent address where you can receive mail.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-3">
            <label htmlFor="first-name" className="block text-sm/6 font-medium text-gray-900">
              First name
            </label>
            <div className="mt-2">
              <input
                id="first-name"
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="last-name" className="block text-sm/6 font-medium text-gray-900">
              Last name
            </label>
            <div className="mt-2">
              <input
                id="last-name"
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600"
              />
            </div>
          </div>

          {/* Email with verified badge */}
          <div className="sm:col-span-4">
            <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900">
              Email address
            </label>
            <div className="mt-2 relative flex items-center">
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 pr-10 text-base text-gray-900 outline outline-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:outline-indigo-600 sm:text-sm/6"
              />
              {user?.emailVerified && (
                <CheckBadgeIcon
                  className="absolute right-3 h-5 w-5 text-green-500"
                  title="Email verified"
                />
              )}
            </div>
          </div>

          {/* Buttons */}
          <div className="col-span-full flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl px-4 py-2 bg-indigo-600 text-white shadow disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save profile"}
            </button>

            {!user?.emailVerified && (
              <button
                type="button"
                onClick={sendVerificationEmail}
                disabled={busy}
                className="rounded-xl px-4 py-2 bg-green-600 text-white shadow disabled:opacity-60"
              >
                {busy ? "Sending…" : "Send verification email"}
              </button>
            )}
          </div>
        </div>
      </form>

      {/* --- Update Password --- */}
      <form
        onSubmit={savePassword}
        className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3"
      >
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Update Password</h2>
          <p className="mt-1 text-sm/6 text-gray-600">
            Choose a strong password you don’t use elsewhere.
          </p>
        </div>

        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-3">
            <label htmlFor="new-password" className="block text-sm/6 font-medium text-gray-900">
              Password
            </label>
            <div className="mt-2">
              <input
                id="new-password"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="sm:col-span-3">
            <label htmlFor="confirm-password" className="block text-sm/6 font-medium text-gray-900">
              Confirm password
            </label>
            <div className="mt-2">
              <input
                id="confirm-password"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600"
              />
            </div>
          </div>

          <div className="col-span-full">
            <button
              type="submit"
              disabled={busy}
              className="rounded-xl px-4 py-2 bg-indigo-600 text-white shadow disabled:opacity-60"
            >
              {busy ? "Updating…" : "Update password"}
            </button>
          </div>
        </div>
      </form>

      {err && <div className="text-sm text-red-600">{err}</div>}
      {note && <div className="text-sm text-green-600">{note}</div>}
    </div>
  );
}
