import { useState } from "react";
import { useAuth } from "../../context/auth";
import { useNavigate } from "react-router-dom";
import { auth } from "../../lib/firebase";
import { sendPasswordResetEmail, setPersistence, browserLocalPersistence, browserSessionPersistence } from "firebase/auth";
import { useToast } from "../../components/ToastProvider"; // <-- NEW

export default function AdminLogin() {
  const { login } = useAuth();
  const nav = useNavigate();
  const { showToast } = useToast(); // <-- NEW

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [note, setNote] = useState(null);

  const onSubmit = async (e) => {
    e.preventDefault();
    setErr(null); setNote(null); setBusy(true);
    try {
      await setPersistence(auth, remember ? browserLocalPersistence : browserSessionPersistence);
      await login(email, password, remember);
      showToast("Signed in successfully."); // <-- toast survives navigation
      nav("/admin");
    } catch (e) {
      const msg = e?.message || "Login failed";
      setErr(msg);
      showToast(msg, "error");
    } finally {
      setBusy(false);
    }
  };

  const onForgot = async (e) => {
    e.preventDefault();
    setErr(null); setNote(null);
    if (!email) {
      const msg = "Enter your email first, then click Forgot password.";
      setErr(msg);
      showToast(msg, "error");
      return;
    }
    try {
      await sendPasswordResetEmail(auth, email);
      setNote("Password reset email sent.");
      showToast("Password reset email sent.");
    } catch (e) {
      const msg = e?.message || "Could not send reset email.";
      setErr(msg);
      showToast(msg, "error");
    }
  };

  return (
    <>
      <div className="flex min-h-full flex-col justify-center px-6 py-12 lg:px-8">
        <div className="sm:mx-auto sm:w-full sm:max-w-sm">
          <img alt="Your Company" src="https://tailwindcss.com/plus-assets/img/logos/mark.svg?color=indigo&shade=600" className="mx-auto h-10 w-auto" />
          <h2 className="mt-10 text-center text-2xl/9 font-bold tracking-tight text-gray-900">Admin Sign in</h2>
        </div>

        <div className="mt-10 sm:mx-auto sm:w-full sm:max-w-sm">
          <form onSubmit={onSubmit} className="space-y-6" noValidate>
            <div>
              <label htmlFor="email" className="block text-sm/6 font-medium text-gray-900">Email address</label>
              <div className="mt-2">
                <input id="email" name="email" type="email" required autoComplete="email"
                  value={email} onChange={(e) => setEmail(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6" />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between">
                <label htmlFor="password" className="block text-sm/6 font-medium text-gray-900">Password</label>
                <div className="text-sm">
                  <button type="button" onClick={onForgot} className="font-semibold text-indigo-600 hover:text-indigo-500">Forgot password?</button>
                </div>
              </div>
              <div className="mt-2">
                <input id="password" name="password" type="password" required autoComplete="current-password"
                  value={password} onChange={(e) => setPassword(e.target.value)}
                  className="block w-full rounded-md bg-white px-3 py-1.5 text-base text-gray-900 outline-1 -outline-offset-1 outline-gray-300 placeholder:text-gray-400 focus:outline-2 focus:-outline-offset-2 focus:outline-indigo-600 sm:text-sm/6" />
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} />
                Remember me
              </label>
            </div>

            {err && <div role="alert" className="text-sm text-red-600">{err}</div>}
            {note && <div role="status" className="text-sm text-green-600">{note}</div>}

            <div>
              <button type="submit" disabled={busy}
                className="flex w-full justify-center rounded-md bg-indigo-600 px-3 py-1.5 text-sm/6 font-semibold text-white shadow-xs hover:bg-indigo-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 disabled:opacity-60">
                {busy ? "Signing in…" : "Sign in"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}