import "./App.css";
import { useState, useEffect, useRef } from "react";
import {
  sendPhoneVerification,
  sendEmailVerification,
  completeEmailVerification,
  isEmailVerificationLink,
  signInWithGoogle,
} from "./services/auth";
import { updateUserProfile } from "./services/profile";
import { ChatPage } from "./components/ChatPage";
// Import ToastContainer and CSS
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

interface AuthPageProps {
  onAuthSuccess: (method: string, value: string) => void;
  setPage: (page: "auth" | "verify" | "profile" | "main") => void;
}

function AuthPage({ onAuthSuccess, setPage }: AuthPageProps) {
  const [mode, setMode] = useState<"phone" | "email">("phone");
  const [value, setValue] = useState("");
  const [countryCode] = useState("+998");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  // Handle phone number input
  const handlePhoneInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value.replace(/\D/g, ""); // Remove non-digits
    if (input.length <= 9) {
      // Format: (XX) XXX-XX-XX
      let formatted = input;
      if (input.length > 2) {
        formatted = `(${input.slice(0, 2)}) ${input.slice(2)}`;
      }
      if (input.length > 5) {
        formatted = `(${input.slice(0, 2)}) ${input.slice(2, 5)}-${input.slice(
          5
        )}`;
      }
      if (input.length > 7) {
        formatted = `(${input.slice(0, 2)}) ${input.slice(2, 5)}-${input.slice(
          5,
          7
        )}-${input.slice(7)}`;
      }
      setValue(formatted);
    }
  };

  // Handle email input
  const handleEmailInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as HTMLElement;
      if (!target.closest(".country-dropdown")) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (value) {
      setIsLoading(true);
      setError("");

      try {
        if (mode === "phone") {
          const phoneNumber = `${countryCode}${value.replace(/\D/g, "")}`;
          const confirmationResult = await sendPhoneVerification(phoneNumber);
          onAuthSuccess(mode, value);
          // Store confirmation result for verification page
          sessionStorage.setItem(
            "confirmationResult",
            JSON.stringify(confirmationResult)
          );
        } else {
          await sendEmailVerification(value);
          onAuthSuccess(mode, value);
        }
      } catch (error) {
        console.error("Authentication error:", error);
        setError(
          mode === "phone"
            ? "Failed to send verification code. Please try again."
            : "Failed to send verification email. Please try again."
        );
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleGoogleSignIn = async () => {
    try {
      const user = await signInWithGoogle();
      if (user) {
        // Skip verification for Google sign-in
        setPage("profile");
      }
    } catch (error) {
      console.error("Google sign-in error:", error);
      // TODO: Show error to user
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      {/* Animated background blobs */}
      <div className="fixed -top-[20%] -left-[20%] w-[70%] h-[70%] bg-gradient-to-br from-orange-600 via-rose-500 to-purple-600 opacity-30 rounded-full blur-3xl animate-spin-slow pointer-events-none" />
      <div className="fixed -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tr from-purple-600 via-rose-500 to-orange-400 opacity-20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="relative w-full max-h-screen flex items-center justify-center px-4 py-8 z-10">
        <div className="bg-zinc-900/90 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-[95vw] sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl animate-fade-in backdrop-blur-md border border-orange-900/30">
          <h1 className="text-4xl md:text-5xl font-extrabold mb-8 text-center tracking-tight animate-slide-down bg-gradient-to-r from-orange-400 via-rose-300 to-purple-400 bg-clip-text text-transparent drop-shadow-lg">
            Welcome to Chat App
          </h1>
          <div className="flex justify-center gap-4 mb-8">
            <button
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-md text-lg md:text-xl ${
                mode === "phone"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white scale-105 shadow-lg"
                  : "bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:scale-105"
              } animate-pop`}
              onClick={() => setMode("phone")}
              type="button"
            >
              Phone
            </button>
            <button
              className={`px-6 py-2 rounded-full font-semibold transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 shadow-md text-lg md:text-xl ${
                mode === "email"
                  ? "bg-gradient-to-r from-orange-500 to-rose-500 text-white scale-105 shadow-lg"
                  : "bg-zinc-800 text-gray-300 hover:bg-zinc-700 hover:scale-105"
              } animate-pop`}
              onClick={() => setMode("email")}
              type="button"
            >
              Email
            </button>
          </div>
          <form
            onSubmit={handleSubmit}
            className="flex flex-col gap-5 animate-fade-in"
          >
            {error && (
              <div className="bg-rose-500/10 text-rose-500 p-3 rounded-lg text-sm animate-fade-in">
                {error}
              </div>
            )}
            {mode === "phone" ? (
              <div className="flex gap-2">
                <div className="relative country-dropdown">
                  <button
                    type="button"
                    className="px-3 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-lg transition-all duration-300 shadow-inner hover:border-orange-400/30 min-w-[80px] text-center"
                    onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  >
                    +998
                  </button>
                </div>
                <input
                  type="tel"
                  placeholder="(90) 123-45-67"
                  className="flex-1 px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-lg transition-all duration-300 shadow-inner hover:border-orange-400/30"
                  value={value}
                  onChange={handlePhoneInput}
                  required
                  pattern="\(\d{2}\)\s\d{3}-\d{2}-\d{2}"
                  title="Please enter a valid Uzbek phone number: (XX) XXX-XX-XX"
                />
              </div>
            ) : (
              <input
                type="email"
                placeholder="Email address"
                className="px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-lg transition-all duration-300 shadow-inner hover:border-orange-400/30"
                value={value}
                onChange={handleEmailInput}
                required
              />
            )}
            <button
              type="submit"
              disabled={isLoading}
              className="bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 animate-pop relative overflow-hidden group disabled:opacity-50 disabled:hover:scale-100"
            >
              <span className="relative z-10">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Processing...
                  </span>
                ) : (
                  "Continue"
                )}
              </span>
              <span className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-lg" />
            </button>
          </form>
          <div className="my-8 flex items-center gap-2 animate-fade-in">
            <div className="flex-1 h-px bg-zinc-700" />
            <span className="text-gray-400 text-sm">or</span>
            <div className="flex-1 h-px bg-zinc-700" />
          </div>
          <button
            onClick={handleGoogleSignIn}
            className="w-full flex items-center justify-center gap-2 bg-white text-zinc-900 font-semibold py-3 rounded-xl hover:bg-zinc-100 transition-all duration-300 shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 animate-pop"
          >
            <svg
              width="20"
              height="20"
              fill="currentColor"
              className="inline-block"
            >
              <path
                d="M19.6 10.23c0-.68-.06-1.36-.17-2H10v3.77h5.5a4.7 4.7 0 0 1-2.04 3.08v2.56h3.3c1.93-1.78 3.04-4.4 3.04-7.41z"
                fill="#4285F4"
              />
              <path
                d="M10 20c2.7 0 4.97-.9 6.63-2.44l-3.3-2.56c-.92.62-2.1.99-3.33.99-2.56 0-4.73-1.73-5.5-4.07H1.1v2.56A9.99 9.99 0 0 0 10 20z"
                fill="#34A853"
              />
              <path
                d="M4.5 12.92A5.98 5.98 0 0 1 4.1 10c0-.99.18-1.95.4-2.92V4.52H1.1A9.99 9.99 0 0 0 0 10c0 1.64.39 3.19 1.1 4.52l3.4-2.56z"
                fill="#FBBC05"
              />
              <path
                d="M10 3.96c1.47 0 2.8.51 3.84 1.5l2.88-2.88C14.97 1.1 12.7 0 10 0A9.99 9.99 0 0 0 1.1 4.52l3.4 2.56C5.27 5.69 7.44 3.96 10 3.96z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </button>
          <div id="recaptcha-container"></div>
        </div>
      </div>
    </div>
  );
}

interface VerificationPageProps {
  authMethod: string;
  authValue: string;
  onVerifySuccess: () => void;
}

function VerificationPage({
  authMethod,
  authValue,
  onVerifySuccess,
}: VerificationPageProps) {
  const [verificationCode, setVerificationCode] = useState("");
  const [isResending, setIsResending] = useState(false);
  const [timeLeft, setTimeLeft] = useState(60);
  const [error, setError] = useState("");

  useEffect(() => {
    // Check if current URL is an email verification link
    if (authMethod === "email" && window.location.href) {
      const email = window.localStorage.getItem("emailForSignIn");
      if (email && isEmailVerificationLink(window.location.href)) {
        completeEmailVerification(email, window.location.href)
          .then(() => {
            window.localStorage.removeItem("emailForSignIn");
            onVerifySuccess();
          })
          .catch((err) => {
            console.error("Verification error:", err);
            setError("Failed to verify email link. Please try again.");
          });
      }
    }
  }, [authMethod, onVerifySuccess]);

  useEffect(() => {
    if (timeLeft > 0) {
      const timer = setTimeout(() => setTimeLeft(timeLeft - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [timeLeft]);

  const handleVerifySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    try {
      if (authMethod === "phone") {
        const confirmationResult = JSON.parse(
          sessionStorage.getItem("confirmationResult") || ""
        );
        if (confirmationResult) {
          await confirmationResult.confirm(verificationCode);
          onVerifySuccess();
        }
      }
    } catch (error) {
      console.error("Verification error:", error);
      setError("Invalid verification code");
    }
  };

  const handleResendCode = async () => {
    setIsResending(true);
    setError("");

    try {
      if (authMethod === "phone") {
        const confirmationResult = await sendPhoneVerification(authValue);
        sessionStorage.setItem(
          "confirmationResult",
          JSON.stringify(confirmationResult)
        );
      } else {
        await sendEmailVerification(authValue);
      }
      setTimeLeft(60);
    } catch (error) {
      console.error("Resend error:", error);
      setError("Failed to resend code");
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      {/* Animated background blobs */}
      <div className="fixed -top-[20%] -left-[20%] w-[70%] h-[70%] bg-gradient-to-br from-orange-600 via-rose-500 to-purple-600 opacity-30 rounded-full blur-3xl animate-spin-slow pointer-events-none" />
      <div className="fixed -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tr from-purple-600 via-rose-500 to-orange-400 opacity-20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />
      <div className="relative w-full max-h-screen flex items-center justify-center px-4 py-8 z-10">
        <div className="bg-zinc-900/90 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-[95vw] sm:max-w-lg md:max-w-xl animate-fade-in backdrop-blur-md border border-orange-900/30">
          <h2 className="text-3xl md:text-4xl font-bold mb-6 text-center bg-gradient-to-r from-orange-400 via-rose-300 to-purple-400 bg-clip-text text-transparent">
            Verify your {authMethod}
          </h2>
          <p className="text-gray-400 text-center mb-8">{authValue}</p>

          {authMethod === "email" ? (
            <div className="text-center space-y-4">
              <div className="bg-zinc-800/50 rounded-lg p-4">
                <p className="text-gray-300">
                  We've sent a verification link to your email address. Please
                  check your inbox and click the link to verify your account.
                </p>
              </div>
              <button
                onClick={handleResendCode}
                disabled={timeLeft > 0 || isResending}
                className="text-orange-400 hover:text-orange-300 transition-colors duration-300 disabled:text-gray-500"
              >
                {isResending
                  ? "Sending..."
                  : timeLeft > 0
                  ? `Resend link in ${timeLeft}s`
                  : "Resend verification link"}
              </button>
            </div>
          ) : (
            <form onSubmit={handleVerifySubmit} className="space-y-6">
              <div className="flex justify-center gap-2">
                {[1, 2, 3, 4, 5, 6].map((_, index) => (
                  <input
                    key={index}
                    type="text"
                    maxLength={1}
                    className="w-12 h-12 text-center text-xl bg-zinc-800 border border-zinc-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all duration-300 shadow-inner hover:border-orange-400/30"
                    value={verificationCode[index] || ""}
                    onChange={(e) => {
                      const value = e.target.value;
                      if (value.match(/^[0-9]$/)) {
                        const newCode =
                          verificationCode.slice(0, index) +
                          value +
                          verificationCode.slice(index + 1);
                        setVerificationCode(newCode);
                        const nextInput = e.target as HTMLInputElement;
                        if (
                          index < 5 &&
                          nextInput.nextElementSibling instanceof
                            HTMLInputElement
                        ) {
                          nextInput.nextElementSibling.focus();
                        }
                      }
                    }}
                    onKeyDown={(e) => {
                      const input = e.target as HTMLInputElement;
                      if (
                        e.key === "Backspace" &&
                        !verificationCode[index] &&
                        index > 0
                      ) {
                        const prevInput = input.previousElementSibling;
                        if (prevInput instanceof HTMLInputElement) {
                          prevInput.focus();
                        }
                      }
                    }}
                  />
                ))}
              </div>

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 relative overflow-hidden group"
                disabled={verificationCode.length !== 6}
              >
                <span className="relative z-10">Verify</span>
                <span className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-lg" />
              </button>
            </form>
          )}

          <div className="mt-6 text-center">
            <button
              onClick={handleResendCode}
              disabled={timeLeft > 0 || isResending}
              className="text-orange-400 hover:text-orange-300 transition-colors duration-300 disabled:text-gray-500"
            >
              {isResending
                ? "Sending..."
                : timeLeft > 0
                ? `Resend code in ${timeLeft}s`
                : "Resend code"}
            </button>
          </div>
          {error && (
            <div className="mt-4 text-rose-500 text-center animate-fade-in">
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

interface ProfilePageProps {
  setPage: (page: "auth" | "verify" | "profile" | "main") => void;
}

function ProfilePage({ setPage }: ProfilePageProps) {
  const [displayName, setDisplayName] = useState("");
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      setError("Please enter a display name");
      return;
    }

    setIsLoading(true);
    setError("");

    try {
      await updateUserProfile(displayName.trim(), photoFile || undefined);
      setPage("main");
    } catch (error) {
      console.error("Profile update error:", error);
      setError("Failed to update profile. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-zinc-950">
      {/* Animated background blobs */}
      <div className="fixed -top-[20%] -left-[20%] w-[70%] h-[70%] bg-gradient-to-br from-orange-600 via-rose-500 to-purple-600 opacity-30 rounded-full blur-3xl animate-spin-slow pointer-events-none" />
      <div className="fixed -bottom-[20%] -right-[20%] w-[70%] h-[70%] bg-gradient-to-tr from-purple-600 via-rose-500 to-orange-400 opacity-20 rounded-full blur-3xl animate-pulse-slow pointer-events-none" />

      <div className="relative w-full max-h-screen flex items-center justify-center px-4 py-8 z-10">
        <div className="bg-zinc-900/90 rounded-3xl shadow-2xl p-6 sm:p-8 w-full max-w-md animate-fade-in backdrop-blur-md border border-orange-900/30">
          <h2 className="text-3xl font-bold mb-6 text-center bg-gradient-to-r from-orange-400 via-rose-300 to-purple-400 bg-clip-text text-transparent">
            Set up your profile
          </h2>

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="flex flex-col items-center gap-4">
              <div
                className="relative w-32 h-32 rounded-full overflow-hidden group cursor-pointer border-2 border-zinc-700 hover:border-orange-500/50 transition-colors duration-300"
                onClick={() => fileInputRef.current?.click()}
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Profile preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full bg-zinc-800 flex items-center justify-center">
                    <svg
                      className="w-12 h-12 text-zinc-600"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                      />
                    </svg>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <span className="text-white text-sm">Change Photo</span>
                </div>
              </div>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                ref={fileInputRef}
                onChange={handlePhotoSelect}
              />
              <div className="text-sm text-zinc-400">
                Click to upload profile picture
              </div>
            </div>

            <div className="space-y-2">
              <label
                htmlFor="displayName"
                className="block text-sm font-medium text-zinc-300"
              >
                Display Name
              </label>
              <input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 focus:outline-none focus:ring-2 focus:ring-orange-500/50 text-lg transition-all duration-300 shadow-inner hover:border-orange-400/30"
                placeholder="Enter your display name"
                required
              />
            </div>

            {error && (
              <div className="bg-rose-500/10 text-rose-500 p-3 rounded-lg text-sm animate-fade-in">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !displayName.trim()}
              className="w-full bg-gradient-to-r from-orange-500 to-rose-500 hover:from-orange-400 hover:to-rose-400 text-white font-bold py-3 rounded-xl transition-all duration-300 shadow-lg hover:scale-105 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:ring-offset-2 focus:ring-offset-zinc-900 animate-pop relative overflow-hidden group disabled:opacity-50 disabled:hover:scale-100"
            >
              <span className="relative z-10">
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                    Saving...
                  </span>
                ) : (
                  "Continue"
                )}
              </span>
              <span className="absolute left-0 top-0 w-full h-full bg-gradient-to-r from-orange-400 via-rose-500 to-purple-400 opacity-0 group-hover:opacity-20 transition-opacity duration-300 blur-lg" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function App() {
  const [page, setPage] = useState<"auth" | "verify" | "profile" | "main">(
    "auth"
  );
  const [authMethod, setAuthMethod] = useState<string>("");
  const [authValue, setAuthValue] = useState<string>("");

  const handleAuthSuccess = (method: string, value: string) => {
    setAuthMethod(method);
    setAuthValue(value);
    setPage("verify");
  };

  const handleVerifySuccess = () => {
    setPage("profile");
  };

  return (
    <>
      <ToastContainer 
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="dark" // Using dark theme to match your app's styling
      />
      
      {page === "auth" ? (
        <AuthPage onAuthSuccess={handleAuthSuccess} setPage={setPage} />
      ) : page === "verify" ? (
        <VerificationPage
          authMethod={authMethod}
          authValue={authValue}
          onVerifySuccess={handleVerifySuccess}
        />
      ) : page === "profile" ? (
        <ProfilePage setPage={setPage} />
      ) : page === "main" ? (
        <ChatPage />
      ) : null}
    </>
  );
}


export default App;
