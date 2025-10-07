// src/pages/.../Profile.jsx
import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Button from "../../components/Button";
import { useAuth } from "../../context/auth";
import {
  updateProfile,
  updateEmail,
  updatePassword,
  sendEmailVerification,
} from "firebase/auth";
import { CheckBadgeIcon } from "@heroicons/react/24/solid";

function titleCaseName(str) {
  return (str || "")
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function OverlaySpinner({ show }) {
  if (!show) return null;
  return (
    <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[1px]">
      <div className="absolute left-1/2 top-6 -translate-x-1/2">
        <div className="flex items-center gap-2 text-gray-700">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 0 1 8-8v4a4 4 0 0 0-4 4H4z" />
          </svg>
          <span className="text-sm">Working…</span>
        </div>
      </div>
    </div>
  );
}

const PASSWORD_RULES = {
  minLength: 12,
  requireLower: /[a-z]/,
  requireUpper: /[A-Z]/,
  requireNumber: /\d/,
  requireSymbol: /[^A-Za-z0-9]/,
};

function getPasswordIssues(pw = "") {
  const issues = [];
  if (pw.length < PASSWORD_RULES.minLength)
    issues.push(`At least ${PASSWORD_RULES.minLength} characters`);
  if (!PASSWORD_RULES.requireLower.test(pw)) issues.push("At least one lowercase letter");
  if (!PASSWORD_RULES.requireUpper.test(pw)) issues.push("At least one uppercase letter");
  if (!PASSWORD_RULES.requireNumber.test(pw)) issues.push("At least one number");
  if (!PASSWORD_RULES.requireSymbol.test(pw)) issues.push("At least one symbol (e.g. ! @ # $ %)");
  return issues;
}

function RuleItem({ ok, children }) {
  return (
    <li className="flex items-center gap-2 text-sm">
      <span className={`inline-flex h-4 w-4 items-center justify-center rounded-full border ${ok ? "border-green-500" : "border-gray-300"}`}>
        <svg viewBox="0 0 20 20" className={`h-3 w-3 ${ok ? "text-green-600" : "text-gray-400"}`}>
          <path fill="currentColor" d="M8.143 13.314 4.83 10l-1.18 1.178 4.493 4.493L16.35 7.463l-1.178-1.18z" />
        </svg>
      </span>
      <span className={ok ? "text-green-700" : "text-gray-600"}>{children}</span>
    </li>
  );
}

/* ----------------- Simple Toast ----------------- */
function Toast({ message, type }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      className={`fixed bottom-6 right-6 z-50 rounded-md px-4 py-2 text-sm shadow-lg text-white ${
        type === "error" ? "bg-red-600" : "bg-green-600"
      }`}
    >
      {message}
    </motion.div>
  );
}

/* ----------------- Main Component ----------------- */
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

  const [busyProfile, setBusyProfile] = useState(false);
  const [busyPassword, setBusyPassword] = useState(false);
  const [busyVerify, setBusyVerify] = useState(false);
  const anyBusy = busyProfile || busyPassword || busyVerify;

  const [toast, setToast] = useState(null);

  const [initial, setInitial] = useState(null);
  const addrKey = useMemo(() => (user ? `profile_addr_${user.uid}` : null), [user]);

  useEffect(() => {
    if (!user) return;
    const displayName = user.displayName || "";
    const [fn, ...rest] = displayName.split(" ").filter(Boolean);
    const initFirst = fn || "";
    const initLast = rest.join(" ") || "";
    const initEmail = user.email || "";

    let initStreet = "", initCity = "", initRegion = "", initPostal = "";
    try {
      const raw = addrKey && localStorage.getItem(addrKey);
      if (raw) {
        const a = JSON.parse(raw);
        initStreet = a.street ?? "";
        initCity = a.city ?? "";
        initRegion = a.region ?? "";
        initPostal = a.postal ?? "";
      }
    } catch {}

    setFirstName(initFirst);
    setLastName(initLast);
    setEmail(initEmail);
    setStreet(initStreet);
    setCity(initCity);
    setRegion(initRegion);
    setPostal(initPostal);
    setInitial({ firstName: initFirst, lastName: initLast, email: initEmail, street: initStreet, city: initCity, region: initRegion, postal: initPostal });
  }, [user, addrKey]);

  const profileDirty = useMemo(() => {
    if (!initial) return false;
    return (
      firstName !== initial.firstName ||
      lastName !== initial.lastName ||
      email !== initial.email ||
      street !== initial.street ||
      city !== initial.city ||
      region !== initial.region ||
      postal !== initial.postal
    );
  }, [firstName, lastName, email, street, city, region, postal, initial]);

  const passwordsMatch = useMemo(
    () => newPassword !== "" && confirmPassword !== "" && newPassword === confirmPassword,
    [newPassword, confirmPassword]
  );

  const passwordIssues = useMemo(() => getPasswordIssues(newPassword), [newPassword]);
  const passwordValid = passwordIssues.length === 0;

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const saveProfile = async (e) => {
    e.preventDefault();
    if (!user) return;
    setBusyProfile(true);
    try {
      const cappedFirst = titleCaseName(firstName);
      const cappedLast = titleCaseName(lastName);
      setFirstName(cappedFirst);
      setLastName(cappedLast);
      const displayName = [cappedFirst, cappedLast].join(" ").trim() || null;
      await updateProfile(user, { displayName });
      if (email && email !== user.email) await updateEmail(user, email);
      await user.reload();

      const payload = { street, city, region, postal };
      try {
        if (addrKey) localStorage.setItem(addrKey, JSON.stringify(payload));
      } catch {}
      setInitial({ firstName: cappedFirst, lastName: cappedLast, email, street, city, region, postal });
      showToast("Profile updated successfully.");
    } catch (e) {
      showToast(e?.message || "Failed to update profile.", "error");
    } finally {
      setBusyProfile(false);
    }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    if (!user) return;
    setBusyPassword(true);
    try {
      const issues = getPasswordIssues(newPassword);
      if (issues.length) throw new Error(`Password requirements not met: ${issues.join("; ")}`);
      if (newPassword !== confirmPassword) throw new Error("Passwords do not match.");
      await updatePassword(user, newPassword);
      setNewPassword("");
      setConfirmPassword("");
      showToast("Password updated successfully.");
    } catch (e) {
      if (e?.code === "auth/requires-recent-login") {
        showToast("Please re-login and try updating your password again.", "error");
      } else {
        showToast(e?.message || "Failed to update password.", "error");
      }
    } finally {
      setBusyPassword(false);
    }
  };

  const sendVerificationEmail = async () => {
    if (!user) return;
    setBusyVerify(true);
    try {
      await sendEmailVerification(user);
      showToast("Verification email sent.");
    } catch (e) {
      showToast(e?.message || "Failed to send verification email.", "error");
    } finally {
      setBusyVerify(false);
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-8 relative">
      <AnimatePresence>{anyBusy && <motion.div className="absolute inset-0 z-10" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><OverlaySpinner show /></motion.div>}</AnimatePresence>
      <AnimatePresence>{toast && <Toast key={toast.msg} message={toast.msg} type={toast.type} />}</AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Profile</h1>
        <Button variant="outline" onClick={logout}>
          Sign out
        </Button>
      </div>

      {/* Personal Information */}
      <form onSubmit={saveProfile} className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Personal Information</h2>
          <p className="mt-1 text-sm/6 text-gray-600">Use a permanent address where you can receive mail.</p>
        </div>
        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">First name</label>
            <input value={firstName} onChange={(e) => setFirstName(e.target.value)} className="mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600" />
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">Last name</label>
            <input value={lastName} onChange={(e) => setLastName(e.target.value)} className="mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600" />
          </div>
          <div className="sm:col-span-4">
            <label className="block text-sm/6 font-medium text-gray-900">Email address</label>
            <div className="mt-2 relative flex items-center">
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="block w-full rounded-md bg-white px-3 py-1.5 pr-10 text-base text-gray-900 outline outline-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:outline-indigo-600 sm:text-sm/6" />
              {user?.emailVerified && <CheckBadgeIcon className="absolute right-3 h-5 w-5 text-green-500" title="Email verified" />}
            </div>
          </div>
          <div className="col-span-full flex flex-wrap items-center gap-3">
            {profileDirty && <Button type="submit" loading={busyProfile} loadingText="Saving…">Save profile</Button>}
            {!user?.emailVerified && <Button type="button" onClick={sendVerificationEmail} loading={busyVerify} variant="secondary" loadingText="Sending…">Send verification email</Button>}
          </div>
        </div>
      </form>

      {/* Update Password */}
      <form onSubmit={savePassword} className="grid grid-cols-1 gap-x-8 gap-y-10 border-b border-gray-900/10 pb-12 md:grid-cols-3">
        <div>
          <h2 className="text-base/7 font-semibold text-gray-900">Update Password</h2>
          <p className="mt-1 text-sm/6 text-gray-600">Choose a strong password you don’t use elsewhere.</p>
        </div>
        <div className="grid max-w-2xl grid-cols-1 gap-x-6 gap-y-8 sm:grid-cols-6 md:col-span-2">
          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">Password</label>
            <input type="password" name="new-password" autoComplete="new-password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} className="mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600" />
            <ul className="mt-2 space-y-1">
              <RuleItem ok={newPassword.length >= PASSWORD_RULES.minLength}>At least {PASSWORD_RULES.minLength} characters</RuleItem>
              <RuleItem ok={PASSWORD_RULES.requireLower.test(newPassword)}>At least one lowercase letter</RuleItem>
              <RuleItem ok={PASSWORD_RULES.requireUpper.test(newPassword)}>At least one uppercase letter</RuleItem>
              <RuleItem ok={PASSWORD_RULES.requireNumber.test(newPassword)}>At least one number</RuleItem>
              <RuleItem ok={PASSWORD_RULES.requireSymbol.test(newPassword)}>At least one symbol (e.g. ! @ # $ %)</RuleItem>
            </ul>
          </div>
          <div className="sm:col-span-3">
            <label className="block text-sm/6 font-medium text-gray-900">Confirm password</label>
            <input type="password" name="new-password-confirm" autoComplete="new-password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="mt-2 block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline outline-1 outline-gray-300 focus:outline-2 focus:outline-indigo-600" />
            {!passwordsMatch && (newPassword || confirmPassword) && <p className="mt-1 text-xs text-rose-600">Passwords do not match.</p>}
          </div>
          <div className="col-span-full">
            {passwordsMatch && passwordValid && <Button type="submit" loading={busyPassword} loadingText="Updating…">Update password</Button>}
          </div>
        </div>
      </form>
    </div>
  );
}