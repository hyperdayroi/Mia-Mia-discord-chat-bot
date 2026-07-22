import fs from "fs";

// Store JSON-file đơn giản, dùng chung logic cho memory/usage/family-context.
// Mỗi persona truyền vào file path riêng của mình -> dữ liệu không bao giờ bị trộn lẫn.
export function createJsonStore(filePath, defaultValue = {}) {
  let data = defaultValue;

  if (fs.existsSync(filePath)) {
    try {
      data = JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch {
      data = defaultValue;
    }
  }

  function save() {
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
