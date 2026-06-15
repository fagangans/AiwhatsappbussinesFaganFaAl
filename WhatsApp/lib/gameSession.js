const sessions = new Map();

export function getSession(chatId, senderId) {
  const key = `${chatId}:${senderId}`;
  return sessions.get(key) || null;
}

export function setSession(chatId, senderId, data) {
  const key = `${chatId}:${senderId}`;
  const old = sessions.get(key);
  if (old?.timer) clearTimeout(old.timer);
  sessions.set(key, { ...data, startTime: Date.now() });
}

export function deleteSession(chatId, senderId) {
  const key = `${chatId}:${senderId}`;
  const s = sessions.get(key);
  if (s?.timer) clearTimeout(s.timer);
  sessions.delete(key);
}

export function hasSession(chatId, senderId) {
  return sessions.has(`${chatId}:${senderId}`);
}
