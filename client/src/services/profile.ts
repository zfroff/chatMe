import { getAuth, updateProfile } from "firebase/auth";
import { getStorage, ref, uploadBytes, getDownloadURL } from "firebase/storage";

const auth = getAuth();
const storage = getStorage();

const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "image/gif"];

export const uploadProfilePicture = async (file: File) => {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    throw new Error(
      "Unsupported file type. Please use JPEG, PNG or GIF images."
    );
  }
  // Upload image to Firebase Storage
  const storageRef = ref(storage, `profile_pictures/${auth.currentUser?.uid}`);
  const snapshot = await uploadBytes(storageRef, file);
  return await getDownloadURL(snapshot.ref);
};

export const updateUserProfile = async (
  displayName: string,
  photoFile?: File
) => {
  try {
    if (!auth.currentUser) throw new Error("No authenticated user");

    let photoURL = auth.currentUser.photoURL;

    if (photoFile) {
      photoURL = await uploadProfilePicture(photoFile);
    }

    // Update profile
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL,
    });

    return {
      displayName,
      photoURL,
    };
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};
