export const MAX_REGISTRATION_PHOTO_BYTES = 5 * 1024 * 1024;
export function validateRegistrationPhoto(photo: { size: number; type: string } | null): string | null {
  if (!photo || photo.size === 0) return "Tire ou selecione uma foto segurando seu RG.";
  if (photo.size > MAX_REGISTRATION_PHOTO_BYTES) return "A foto deve ter até 5 MB.";
  if (!["image/jpeg", "image/png", "image/webp"].includes(photo.type)) return "Selecione uma foto JPG, PNG ou WebP.";
  return null;
}