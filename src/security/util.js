// Bọc mọi event handler của Security Engine — 1 lỗi ở đây sẽ không bao giờ làm sập bot (Part 24 tinh thần chung).
export function safeHandler(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error("SECURITY_HANDLER_ERROR:", err);
    }
  };
}
