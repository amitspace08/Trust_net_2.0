export function isValidPhone(phone) {
  return /^\+?[0-9]{10,15}$/.test(phone);
}
