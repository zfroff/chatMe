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

export const checkNickname = async (nickname: string) => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/check-nickname`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ nickname }),
    });

    const data = await response.json();
    return data.success;
  } catch (error) {
    console.error('Error checking nickname:', error);
    throw error;
  }
};

export const updateUserProfile = async (
  displayName: string,
  nickname: string,
  photoFile?: File
) => {
  try {
    if (!auth.currentUser) throw new Error("No authenticated user");

    // First check if nickname is available
    const isNicknameAvailable = await checkNickname(nickname);
    if (!isNicknameAvailable) {
      throw new Error('Nickname is already taken');
    }

    let photoURL = auth.currentUser.photoURL;

    if (photoFile) {
      photoURL = await uploadProfilePicture(photoFile);
    }

    // Update profile
    await updateProfile(auth.currentUser, {
      displayName,
      photoURL,
    });

    // Update nickname in the backend
    const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:3000'}/api/update-profile`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${await auth.currentUser.getIdToken()}`,
      },
      body: JSON.stringify({
        nickname,
        displayName,
        photoURL,
      }),
    });

    const data = await response.json();
    if (!data.success) {
      throw new Error(data.error || 'Failed to update profile');
    }

    return {
      displayName,
      nickname,
      photoURL,
    };
  } catch (error) {
    console.error("Error updating profile:", error);
    throw error;
  }
};
