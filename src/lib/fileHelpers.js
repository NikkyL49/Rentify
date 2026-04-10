export function sanitizeFileName(name) {
  return String(name ?? "").replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function validateImageFile(file, maxBytes = 5 * 1024 * 1024) {
  if (!file) return null;

  if (!file.type?.startsWith("image/")) {
    return "Please upload an image file.";
  }

  if (file.size >= maxBytes) {
    return "Image must be smaller than 5MB.";
  }

  return null;
}
