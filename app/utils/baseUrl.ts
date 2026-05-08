/**
 * Normalize Worker/API origin (no trailing slash).
 * If the URL mistakenly ends with path `/api`, strip it so callers can safely append `/api/...`.
 */
export function normalizeWorkerOrigin(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) return "";
  try {
    const u = new URL(trimmed);
    let path = u.pathname.replace(/\/+$/, "") || "";
    if (path === "/api") {
      return u.origin;
    }
    return path === "/" ? u.origin : `${u.origin}${path}`;
  } catch {
    return trimmed.replace(/\/?api\/?$/i, "").replace(/\/+$/, "");
  }
}

// 从环境变量获取后端地址（去掉误加的 `/api` 后缀），默认为相对路径
export const BASE_URL = normalizeWorkerOrigin(process.env.NEXT_PUBLIC_API_URL || "");

/**
 * 为URL添加基础地址
 * @param url 相对路径或完整URL
 * @returns 完整URL
 */
export function getFullUrl(url: string): string {
  if (!url) return "";
  if (url.startsWith("http://") || url.startsWith("https://")) {
    // console.log("完整URL", url);
    return url;
  }

  // 如果是相对路径，添加BASE_URL
  try {
    // 在浏览器环境下
    if (typeof window !== "undefined") {
      const nurl = new URL(url, BASE_URL || window.location.origin).toString();
      return nurl;
    }
    // 在服务器环境下
    // console.log(`${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`);
    return `${BASE_URL}${url.startsWith("/") ? url : `/${url}`}`;
  } catch (error) {
    console.error("URL格式错误:", error);
    return url;
  }
}
