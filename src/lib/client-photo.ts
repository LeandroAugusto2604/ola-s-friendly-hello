import { CLIENT_REGISTRATION_URL } from "@/config/app";
import { isRegistrationToken } from "@/lib/client-registration";
import { validateRegistrationPhoto } from "@/lib/registration-photo";

export function clientPhotoVerified(path: string | null, legacy?: { status: string; photo_url: string | null } | null) {
  return Boolean(path || (legacy?.status === "completed" && legacy.photo_url));
}
export function validateOptionalRegistrationPhoto(photo: { size: number; type: string } | null) {
  return photo === null ? null : validateRegistrationPhoto(photo);
}
export function clientPhotoUrl(token: string) {
  if (!isRegistrationToken(token)) throw new Error("Link inválido");
  return `${CLIENT_REGISTRATION_URL}/#/foto-cliente/${token}`;
}