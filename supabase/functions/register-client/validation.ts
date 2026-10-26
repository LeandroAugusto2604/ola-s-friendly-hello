import { z } from "npm:zod@3";

export const registrationSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{64}$/),
  fullName: z.string().trim().min(3).max(150),
  address: z.string().trim().min(5).max(500),
  phone: z.string().max(15).refine(v => /^\d{10,11}$/.test(v.replace(/\D/g, ""))),
  rg: z.string().trim().min(5).max(30),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$|^\d{11}$/),
});
export const MAX_PHOTO_BYTES = 5 * 1024 * 1024;
export function photoExtension(bytes: Uint8Array): string | null {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "jpg";
  if ([137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v)) return "png";
  if (String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}