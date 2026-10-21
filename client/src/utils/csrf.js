// The server sets a readable "csrfToken" cookie at login and also returns the token in the response
// body. Cookie-authenticated unsafe requests must echo it in the X-CSRF-Token header.
const KEY = "lms_csrf";

export function getCsrfToken() {
  const m = document.cookie.match(/(?:^|; )csrfToken=([^;]+)/);
  return m ? decodeURIComponent(m[1]) : sessionStorage.getItem(KEY) || "";
}
export const saveCsrfToken = (t) => (t ? sessionStorage.setItem(KEY, t) : sessionStorage.removeItem(KEY));
