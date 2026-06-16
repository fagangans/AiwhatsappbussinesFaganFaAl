import axios from "axios";

const WEBPILOT_URL = "https://api.fromscratch.web.id/v1/api/ai/webpilot/details";

export async function searchWeb(query) {
  try {
    const { data } = await axios.get(
      `${WEBPILOT_URL}?query=${encodeURIComponent(query)}`,
      { timeout: 10000 },
    );
    if (data.status !== 200 || !data.data?.response) return null;
    return data.data.response;
  } catch {
    return null;
  }
}
