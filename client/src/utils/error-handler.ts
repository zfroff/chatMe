import { toast } from 'react-toastify';

export const handleError = (error: unknown, showToast = true) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  console.error(message);

  if (showToast) {
    toast.error(message);
  }

  return message;
};