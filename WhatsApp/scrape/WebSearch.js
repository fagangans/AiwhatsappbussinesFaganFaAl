import axios from "axios";

const API_URL = "https://api.fromscratch.web.id/v1/api/ai/webpilot/details";

export async function searchWeb(query) {
  const { data } = await axios.get(
    `${API_URL}?query=${encodeURIComponent(query)}`,
    { timeout: 15000 },
  );
  if (data.status !== 200 || !data.data?.response) return null;
  return data.data.response;
}
