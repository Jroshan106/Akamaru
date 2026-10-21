export const testEnv = {
  AUTH_USERNAME: 'test-account',
  AUTH_PASSWORD: 'test-password-not-a-real-secret',
  AUTH_SESSION_SECRET: 'ab'.repeat(32),
};
export function configureTestAuth() { Object.assign(process.env, testEnv); }
export async function authenticatedFetch(base) {
  const response = await fetch(`${base}/api/auth/login`, {
    method: 'POST', headers: { Origin: base, 'Content-Type': 'application/json', 'X-Akamaru-Request': 'auth' },
    body: JSON.stringify({ username: testEnv.AUTH_USERNAME, password: testEnv.AUTH_PASSWORD }),
  });
  if (!response.ok) throw new Error(`Test login failed: ${response.status}`);
  const cookie = response.headers.getSetCookie()[0].split(';')[0];
  return (url, init = {}) => fetch(url, { ...init, headers: { ...init.headers, Cookie: cookie } });
}
