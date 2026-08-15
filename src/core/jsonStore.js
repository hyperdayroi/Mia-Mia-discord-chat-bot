import fs from "fs";
import path from "path";

// Store JSON-file đơn giản, dùng chung logic cho memory/usage/family-context/giveaway/...
// Mỗi persona/tính năng truyền vào file path riêng -> dữ liệu không bao giờ bị trộn lẫn.
export function createJsonStore(filePath, defaultValue = {}) {
  let data = defaultValue;

  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      data = defaultValue;
    }
  }

  function save() {
    // Đảm bảo thư mục vẫn tồn tại lúc ghi (phòng trường hợp volume mount muộn hơn lúc load).
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFile(filePath, JSON.stringify(data, null, 2), err => {
      if (err) console.error(`SAVE_STORE_ERROR (${filePath}):`, err);
    });
  }

  return {
    get data() {
      return data;
    },
    save,
    filePath
  };
}
