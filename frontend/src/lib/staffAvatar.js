// Receptionists cannot upload a profile photo, so every receptionist shows the
// same illustration (public/receptionist-avatar.png). Avatar passes `src`
// through fileUrl(), which prefixes the API host unless the value already
// starts with http — so this is an absolute URL on the frontend's own origin.
export const RECEPTIONIST_AVATAR = `${window.location.origin}/receptionist-avatar.png`
