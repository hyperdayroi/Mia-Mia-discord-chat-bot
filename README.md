# HyperAI — Mia Discord Bot

Mia là một Discord bot AI chat, đóng vai **"con gái" của Owner** khi Owner nhắn tin, còn với người khác thì là một người bạn Discord bình thường. Bot dùng model chat qua API riêng (`api.xah.io`), có memory theo từng user, hỗ trợ đọc ảnh, tạo ảnh AI, và có sẵn tính năng gửi QR nhận tiền ("anxin").

---

## 🚀 Features

- **Chat AI qua mention** (`@Mia ...`) hoặc slash command `/ask`
- **Nhận diện Owner riêng biệt**: Owner được persona xưng "con - bố", user khác thì persona xưng "tớ - cậu"
- **Memory theo từng user** (tối đa 15 message gần nhất, lưu trong `memory.json`)
- **Đọc ảnh trong tin nhắn/reply** và mô tả lại (gửi kèm ảnh qua `image_url` cho model)
- **Tạo ảnh AI** bằng slash command `/image`
- **Tự động lọc thẻ `<think>...</think>`** khỏi câu trả lời trước khi gửi
- **Tự động chia nhỏ tin nhắn dài** (>1900 ký tự) thành nhiều phần
- **Tính năng "anxin"**: gõ `anxin` để bot gửi embed + nút chọn mã QR (Momo, MBank, Vietcombank, ZaloPay)
- Slash commands: `/ask`, `/image`, `/ping`, `/status`

---

## 🛠 Tech Stack

- **Node.js (ESM)**
- **discord.js v14**
- **node-fetch**
- **Chat API**: `https://api.xah.io/v1/chat/completions`
  - Model: `haidinhphu1704/Claude-fable-5`
- **Image API**: `https://api.xah.io/v1/images/generations`
  - Model: `phuocanh421994/Wan2.7_Image_Pro`
- **Storage**: JSON file (`memory.json`), không dùng database
- **Env config**: dotenv

---

## 📁 Project Structure

```
HyperAI/
│
├─ index.js          # Toàn bộ logic bot (register commands, chat, image, QR)
├─ memory.json        # Bộ nhớ hội thoại theo từng user
├─ qr-momo.jpg
├─ qr-mb.jpg
├─ qr-vcb.jpg
├─ qr-zalo.jpg
├─ package.json
├─ .env               # Biến môi trường (tự tạo)
└─ README.md
```

---

## ⚙️ Setup & Installation

### 1. Clone repository

```bash
git clone https://github.com/hyperdayroi/HyperAI-.git
cd HyperAI-
```

### 2. Install dependencies

```bash
npm install
```

### 3. Environment variables

Tạo file `.env` ở thư mục gốc:

```
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_DISCORD_CLIENT_ID
CKEY_API_KEY=YOUR_XAH_API_KEY
```

### 4. Cấu hình Owner / Mom ID

Trong `index.js`, sửa lại đúng ID Discord của bạn:

```js
const OWNER_ID = "YOUR_DISCORD_ID";
const MOM_ID = "MOM_DISCORD_ID"; // chỉ dùng trong system prompt, chưa có logic riêng
```

### 5. Chuẩn bị ảnh QR (tuỳ chọn)

Nếu muốn dùng tính năng `anxin`, đặt các file ảnh QR đúng tên vào thư mục gốc:

```
qr-momo.jpg
qr-mb.jpg
qr-vcb.jpg
qr-zalo.jpg
```

Thiếu file nào thì lệnh chọn QR tương ứng sẽ báo lỗi "Thiếu file ...".

---

## ▶️ Run the bot

```bash
node index.js
```

Console output:

```
Mia online: <bot-tag>
```

Bot tự động đăng ký slash commands lên application mỗi khi khởi động (`rest.put(Routes.applicationCommands(...))`).

---

## 💬 Usage

### Chat qua mention

```
@Mia hôm nay bố mệt quá
```

Có thể đính kèm ảnh hoặc reply vào tin nhắn có ảnh — Mia sẽ nhận và "nhìn" được ảnh đó.

### Slash Commands

| Command   | Mô tả                                    |
| --------- | ------------------------------------------ |
| `/ask`    | Hỏi Mia (không giữ được ảnh đính kèm)      |
| `/image`  | Tạo ảnh AI theo mô tả (prompt)             |
| `/ping`   | Kiểm tra độ trễ WebSocket                  |
| `/status` | Xem model đang dùng + số user có memory    |

### Text trigger

Gõ `anxin` trong bất kỳ kênh nào → bot gửi embed kèm nút chọn mã QR để nhận tiền.

---

## 🧠 Persona Logic

System prompt được sinh động theo `uid` của người nhắn (`systemPrompt(uid)`):

- **Nếu là `OWNER_ID`**: Mia xưng "con", gọi Owner là "bố", tính cách bé gái 5 tuổi, quấn quýt, không nhận là AI/chatbot.
- **Người khác**: Mia xưng "tớ", gọi "cậu", thân thiện, không công nhận ai khác là bố/mẹ kể cả khi họ tự nhận.

Cả hai persona đều bị cấm: tự giới thiệu là AI, nhắc đến prompt/quy tắc, lặp lại lời người dùng.

---

## 🧩 Design Notes

- Chỉ dùng **1 model chat + 1 model ảnh cố định**, không cho chọn model → dễ debug, ổn định
- Memory giới hạn 15 message/user để tránh phình context
- Có xử lý loại bỏ block `<think>...</think>` nếu model trả về (một số model reasoning sẽ leak phần suy nghĩ)
- `/ask` hiện chưa hỗ trợ đính kèm ảnh (chỉ nhánh mention mới đọc được ảnh)
- Không có persistence ngoài file JSON → mất memory nếu xoá `memory.json`

---

## ⚠️ Notes

- Cần `CKEY_API_KEY` hợp lệ cho `api.xah.io`, nếu hết quota bot sẽ báo "Lỗi AI rồi bố ơi." / "Chịu rồi lỗi mất tiêu"
- Không dùng database → memory reset nếu xoá file `memory.json`
- Chưa có lệnh `/resetmemory` hay `/shutdown` trong code hiện tại (nếu cần, phải tự thêm)
- Bot có phong cách cà khịa, đóng vai gia đình → cân nhắc trước khi thêm vào server đông người lạ hoặc server có trẻ em

---

## 📄 License

MIT License — dùng cho mục đích học tập và cá nhân.

---

## 🛡️ Mia Security Engine (Phase 1 + 2)

Đã thêm Anti-Nuke, Anti-Raid, Anti-Bot-Risk, Anti-Spam, Anti-Flood, Anti-Link, Anti-Mention, Permission Firewall, Emergency Lockdown, Risk Scoring, Event Correlation, Whitelist, Security Log Channel và lệnh `/security`. Toàn bộ AI chat / memory / quota / QR cũ giữ nguyên không đổi.

**Bắt buộc trước khi chạy:**
1. [Discord Developer Portal](https://discord.com/developers/applications) → app của bot → tab **Bot** → bật **"Server Members Intent"** (privileged intent — thiếu bước này bot sẽ không login được, lỗi "Used disallowed intents").
2. Đảm bảo role của bot có quyền **View Audit Log** trong server (bắt buộc để xác định ai thực hiện hành động phá hoại — không đoán từ tin nhắn).
3. Đảm bảo role của bot có quyền **Manage Messages** (để xoá tin spam/link/mention) và **Moderate Members** (để timeout khi vi phạm nhiều lần).

**Lệnh:** `/security status|config|logs|threats|reset|lockdown|unlockdown|setup|enable|disable`, `/security whitelist user-add|user-remove|role-add|role-remove|bot-add|bot-remove`, `/security link block-add|block-remove`.

**Phase 1 — hành vi phá hoại (qua Audit Log thật):** xoá/tạo kênh & role, mass ban/kick, webhook abuse, role được nâng quyền, tốc độ join (Anti-Raid), bot mới có quyền nguy hiểm, chấm điểm rủi ro có decay, phát hiện tổ hợp nuke pattern, Permission Firewall (gỡ quyền trước khi ban), Emergency Lockdown (tự khôi phục đúng kênh), kênh log tự fallback về console nếu thiếu quyền/kênh.

**Phase 2 — hành vi trong tin nhắn:** flood (gửi quá nhanh), duplicate/character/emoji spam, spam đính kèm file, link bị chặn hoặc nghi ngờ phishing (so khớp domain, KHÔNG gọi network để kiểm tra URL), mass mention (@everyone/@here dùng bừa, mention quá nhiều người). Vi phạm sẽ bị xoá tin ngay; nếu risk score dồn tới HIGH_RISK/CRITICAL thì tự động timeout 10 phút / 1 tiếng. Anti-Spam và Anti-Flood là 2 module độc lập (bật/tắt riêng qua `/security enable|disable`), dù dùng chung dữ liệu theo dõi tin nhắn.

Heuristic phát hiện phishing ở Anti-Link chỉ so khớp chuỗi (domain giả mạo discord/steam, TLD đáng ngờ + từ khoá lừa đảo) — luôn có thể có sai sót, cơ chế chắc chắn nhất vẫn là tự thêm domain vào blocklist qua `/security link block-add <domain>`.

**Chưa có (Phase 3):** Server Snapshot & Backup/Restore, `/security backup`, `/security emergency`, báo cáo forensic timeline đầy đủ.

State lưu ở `security.json` (cùng kiểu file phẳng như `memory.json`/`usage.json`), cô lập hoàn toàn theo từng server — server này không bao giờ ảnh hưởng tới server khác.
