const baseUrl = (import.meta.env.VITE_API_BASE_URL || 'https://c2ck14z7ga.execute-api.ap-south-1.amazonaws.com/Prod').replace(/\/$/, '');
export async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, { ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.message || `Request failed (${response.status})`);
  return data;
}
