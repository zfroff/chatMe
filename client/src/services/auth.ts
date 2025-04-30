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
  createUserWithEmailAndPassword,
} from "firebase/auth";
import { getFirestore, doc, setDoc, getDoc } from "firebase/firestore";

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
const db = getFirestore(app);
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

// Helper function to create a user document if it doesn't exist
const createUserDocument = async (user: any) => {
  const userDocRef = doc(db, 'users', user.uid);
  const userDoc = await getDoc(userDocRef);
  if (!userDoc.exists()) {
    await setDoc(userDocRef, {
      uid: user.uid,
      email: user.email || '',
      nickname: '', // Placeholder, updated in ProfilePage
      displayName: user.displayName || '',
      photoURL: user.photoURL || '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  }
};

// Email/Password Signup
export const signUpWithEmail = async (email: string, password: string) => {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    await createUserDocument(user);
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    if (window.chatService) {
      window.chatService.updateToken(token);
    }
    return user;
  } catch (error) {
    console.error("Error signing up with email:", error);
    throw error;
  }
};

// Phone authentication
export const sendPhoneVerification = async (phoneNumber: string) => {
  try {
    const verifier = initRecaptcha();
    const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, verifier);
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
      url: window.location.origin,
      handleCodeInApp: true,
    };
    await sendSignInLinkToEmail(auth, email, actionCodeSettings);
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
      const user = result.user;
      await createUserDocument(user);
      const token = await user.getIdToken();
      localStorage.setItem("token", token);
      if (window.chatService) {
        window.chatService.updateToken(token);
      }
      return user;
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
    const user = result.user;
    await createUserDocument(user);
    const token = await user.getIdToken();
    localStorage.setItem("token", token);
    if (window.chatService) {
      window.chatService.updateToken(token);
    }
    return user;
  } catch (error) {
    console.error("Error signing in with Google:", error);
    throw error;
  }
};

export { auth, db };