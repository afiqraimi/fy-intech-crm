export async function sendCrmNotification(subject, body) {
  // Kept for older components; notifications now fire from backend update endpoints.
  return Promise.resolve({ skipped: true, subject, body });
}
