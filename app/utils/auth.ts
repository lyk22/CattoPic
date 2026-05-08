import { normalizeWorkerOrigin } from "./baseUrl";

const API_KEY_KEY = "cattopic_api_key";
export const API_KEY_CHANGE_EVENT = "cattopic_api_key_change";

/** Same-origin `/api/config` (built at deploy time) may carry apiUrl when only API_URL is set server-side. */
async function resolveClientApiBaseUrl(): Promise<string> {
  const fromEnv = normalizeWorkerOrigin(process.env.NEXT_PUBLIC_API_URL || "");
  if (fromEnv) return fromEnv;

  try {
    const response = await fetch("/api/config");
    if (!response.ok) return "";
    const data = (await response.json()) as { apiUrl?: string };
    return normalizeWorkerOrigin(data.apiUrl || "");
  } catch {
    return "";
  }
}
export const getApiKey = (): string | null => {
  if (typeof window !== "undefined") {
    return localStorage.getItem(API_KEY_KEY);
  }
  return null;
};

export const setApiKey = (apiKey: string): void => {
  if (typeof window !== "undefined") {
    localStorage.setItem(API_KEY_KEY, apiKey);
    window.dispatchEvent(new Event(API_KEY_CHANGE_EVENT));
  }
};

export const removeApiKey = (): void => {
  if (typeof window !== "undefined") {
    localStorage.removeItem(API_KEY_KEY);
    window.dispatchEvent(new Event(API_KEY_CHANGE_EVENT));
  }
};

export const validateApiKey = async (apiKey: string): Promise<boolean> => {
  const trimmedKey = apiKey.trim();
  if (!trimmedKey) return false;

  try {
    const base = await resolveClientApiBaseUrl();
    if (!base) {
      console.error(
        "[CattoPic] API base URL is empty. Set NEXT_PUBLIC_API_URL or API_URL in Cloudflare Pages (Production), then redeploy."
      );
      return false;
    }

    const response = await fetch(`${base}/api/validate-api-key`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${trimmedKey}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("API Key validation failed:", {
        url: `${base}/api/validate-api-key`,
        status: response.status,
        statusText: response.statusText,
        responseText: errorText
      });
      return false;
    }

    const data = (await response.json()) as { valid?: boolean };
    return data.valid === true;
  } catch (error) {
    console.error("API Key validation error:", error);
    return false;
  }
};
