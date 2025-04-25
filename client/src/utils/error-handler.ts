export const handleError = (error: unknown, showToast = true) => {
  const message =
    error instanceof Error ? error.message : "An unexpected error occurred";
  console.error(message);

  if (showToast) {
    // Assuming you're using a toast library
    toast.error(message);
  }

  return message;
};
