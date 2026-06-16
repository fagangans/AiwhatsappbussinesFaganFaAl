import axios from "axios";

const WEBPILOT_URL = "https://api.fromscratch.web.id/v1/api/ai/webpilot/details";

async function fetchWebpilot(query, timeoutMs = 30000) {
  const { data } = await axios.get(
    `${WEBPILOT_URL}?query=${encodeURIComponent(query)}`,
    { timeout: timeoutMs },
  );
  if (data.status !== 200 || !data.data?.response) return null;
  return data.data.response;
}

export async function searchWeb(query) {
  try {
    return await fetchWebpilot(query, 30000);
  } catch {
    // retry once with shorter/simpler query (max 80 chars)
    try {
      const short = query.length > 80 ? query.slice(0, 80) : query;
      return await fetchWebpilot(short, 25000);
    } catch {
      return null;
    }
  }
}
