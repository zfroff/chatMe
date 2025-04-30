import { initializeApp } from "firebase/app";
import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  sendSignInLinkToEmail,
  isSignInWithEmailLink,
  signInWithEmailLink,
} from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Initialize reCAPTCHA verifier
let recaptchaVerifier: RecaptchaVerifier | null = null;

export const initRecaptcha = () => {
  if (!recaptchaVerifier) {
    recaptchaVerifier = new RecaptchaVerifier(auth, "recaptcha-container", {
      size: "invisible",
    });
  }
  return recaptchaVerifier;
};

// Phone authentication
export const sendPhoneVerification = async (phoneNumber: string) => {
  try {
    const verifier = initRecaptcha();
    const confirmationResult = await signInWithPhoneNumber(
      auth,
      phoneNumber,
      verifier
    );
    return confirmationResult;
  } catch (error) {
    console.error("Error sending code:", error);
    throw error;
  }
};

// Email authentication with email link
export const sendEmailVerification = async (email: string) => {
  try {
    const actionCodeSettings = {
      // The URL to redirect to after email verification
      url: window.location.origin,
      // This must be true for email link sign-in
      handleCodeInApp: true,
    };

    // Send sign-in link to email
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);

    // Save the email in localStorage to complete sign-in
    window.localStorage.setItem("emailForSignIn", email);

    return true;
  } catch (error) {
    console.error("Error in email verification:", error);
    throw error;
  }
};

// Check if current URL is email verification link
export const isEmailVerificationLink = (url: string) => {
  return isSignInWithEmailLink(auth, url);
};

// Complete email verification process
export const completeEmailVerification = async (email: string, url: string) => {
  try {
    if (isSignInWithEmailLink(auth, url)) {
      const result = await signInWithEmailLink(auth, email, url);
      return result.user;
    }
    throw new Error("Invalid verification link");
  } catch (error) {
    console.error("Error completing email verification:", error);
    throw error;
  }
};

// Google authentication
export const signInWithGoogle = async () => {
  try {
    const result = await signInWithPopup(auth, googleProvider);
    // After successful authentication
    const user = result.user;
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    
    // Also update the chat service if it exists
    if (window.chatService) {
      window.chatService.updateToken(token);
    }
    return result.user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};
