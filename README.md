# HyperAI — Mia & Mie Discord Bots

Hệ thống 2 Discord bot chị em (**Mia** và **Mie**) chạy từ **1 codebase duy nhất**, deploy thành **2 Railway Service độc lập**. Mỗi bot có token, memory, và persona riêng, nhưng dùng chung toàn bộ logic lõi (AI, slash command, memory, usage limit, cooldown...).

Ngoài ra 2 bot có thể **tự động nói chuyện với nhau** qua một kênh giao tiếp nội bộ (HTTP), có giới hạn số lượt để tránh loop vô hạn.

---

## 1. Kiến trúc tổng quan

```
GitHub Repo (1 codebase)
│
├── Railway Service: Mia
│   ├── PERSONA=mia
│   ├── DISCORD_TOKEN riêng
│   ├── CLIENT_ID riêng
│   └── MEMORY_FILE riêng
│
└── Railway Service: Mie
    ├── PERSONA=mie
    ├── DISCORD_TOKEN riêng
    ├── CLIENT_ID riêng
    └── MEMORY_FILE riêng
```

Hai service chạy hoàn toàn độc lập (2 process, 2 filesystem riêng), không share database/file. Chúng chỉ "biết nhau" qua 1 kênh HTTP nội bộ để nói chuyện tự động.

## 2. Cấu trúc thư mục

```
.
├── index.js                  # passthrough -> src/index.js (tương thích ngược "node index.js")
├── package.json
├── .env.example              # liệt kê đầy đủ biến môi trường cần set
├── qr-*.jpg                  # ảnh QR dùng cho tính năng "anxin"
└── src/
    ├── index.js               # entry point — wiring toàn bộ hệ thống
    │
    ├── config/
    │   └── env.js             # đọc & validate toàn bộ biến môi trường, chọn persona
    │
    ├── core/                  # logic dùng CHUNG cho cả Mia và Mie
    │   ├── aiClient.js         # gọi API chat + tạo ảnh
    │   ├── memory.js           # memory hội thoại theo user (file riêng theo persona)
    │   ├── usage.js            # giới hạn số lượt chat/ảnh mỗi ngày
    │   ├── cooldown.js         # cooldown giữa các lần dùng lệnh
    │   ├── jsonStore.js        # store JSON file generic (dùng cho memory/usage/family)
    │   └── text.js             # tiện ích: emoji list, stripThink, splitMessage
    │
    ├── personas/
    │   ├── mia.js              # PROMPT GỐC CỦA MIA — giữ nguyên 100%, không sửa nội dung
    │   ├── mie.js              # persona riêng của Mie (em gái, tinh nghịch hơn)
    │   └── index.js            # chọn persona theo process.env.PERSONA
    │
    ├── discord/
    │   ├── client.js           # tạo Discord Client (intents)
    │   ├── commands.js         # định nghĩa slash command /ask /image /ping /status
    │   ├── registerCommands.js # đăng ký slash command qua REST API
    │   ├── interactions.js     # xử lý slash command + nút/menu chọn QR
    │   └── messages.js         # mention chat + lệnh owner-only (?listsrvr, ?nuke...) + "anxin"
    │
    └── family/
        ├── context.js              # lớp "biết nhau" giữa Mia-Mie (không đụng prompt gốc)
        ├── conversationManager.js  # điều phối hội thoại tự động Mia<->Mie, giới hạn lượt
        └── server.js               # HTTP server nội bộ nhận message từ bot còn lại
```

## 3. Nguyên tắc quan trọng nhất: Prompt Mia được giữ nguyên

Toàn bộ nội dung trong `systemPrompt()` gốc của Mia (cách xưng hô, tính cách, slang, quy tắc bản quyền, owner-prompt/user-prompt...) được copy y nguyên từng ký tự vào `src/personas/mia.js`. Không xoá, không viết lại, không rút gọn.

Thông tin về Mie (em gái) không được nhét vào bên trong chuỗi prompt gốc đó. Thay vào đó, nó được gửi như một system message riêng biệt, đặt cạnh prompt chính khi gọi AI:

```js
[
  { role: "system", content: persona.systemPrompt(uid, guild) },   // prompt gốc, không đổi
  { role: "system", content: getFamilyContextMessage() },          // lớp thông tin gia đình, tách biệt
  ...lịch sử chat
]
```

Nhờ vậy Mia vẫn hành xử y hệt như trước, chỉ có thêm nhận thức là mình có 1 em gái tên Mie.

## 4. Persona system

- `PERSONA=mia` hoặc `PERSONA=mie` quyết định service nào chạy persona nào.
- `src/personas/index.js` đọc `PERSONA`, load đúng file `mia.js` hoặc `mie.js`.
- Mỗi persona export ra object gồm: `systemPrompt()`, `displayName`, `presence`, `askDescription`, các đoạn text riêng (`texts.onlineLog`, `texts.nukeOutro`, `texts.apiErrorApology`...), và thông tin `sibling` (biết chị/em mình là ai).
- Toàn bộ phần Discord/AI/memory/usage/cooldown dùng chung 100% logic, chỉ khác dữ liệu/persona truyền vào.

## 5. Memory — tách biệt hoàn toàn theo persona

- `MEMORY_FILE`: lưu lịch sử chat theo từng user. Mặc định tự sinh theo persona: `memory-mia.json` / `memory-mie.json`.
- `USAGE_FILE`: lưu số lượt chat/ảnh đã dùng trong ngày. Mặc định: `usage-mia.json` / `usage-mie.json`.
- `FAMILY_MEMORY_FILE`: không phải memory riêng tư của user — chỉ lưu vài sự kiện chung giữa 2 chị em (VD: "Mia nói với Mie: ..."). Mỗi service giữ bản local riêng của mình, không share filesystem.
- Vì 2 service là 2 filesystem khác nhau, memory của Mia và Mie không bao giờ trộn lẫn, kể cả khi cùng 1 user chat với cả 2 bot.

## 6. Mia & Mie biết sự tồn tại của nhau

- `src/family/context.js` cung cấp `getFamilyContextMessage()`: một đoạn system-message ngắn cho AI biết "bạn là ai, ai là chị/em bạn, không được tự nhận là người kia".
- Đoạn này được gắn vào mọi lần gọi AI (kể cả chat bình thường với user, không chỉ lúc 2 bot tự nói chuyện), để Mia/Mie luôn nhất quán về danh tính.
- Không có việc lộ memory riêng tư của bên này cho bên kia — chỉ có các "sự kiện chung" (ai nói gì với ai) được ghi lại.

## 7. Mia & Mie tự động nói chuyện với nhau

### Cơ chế

Mỗi service chạy kèm 1 HTTP server nội bộ (`src/family/server.js`), expose:

```
POST /internal/chat
Header: x-internal-secret: <INTERNAL_SECRET>
Body: { from, to, conversationId, turn, message, ended }
```

- Bot nào chủ động bắt chuyện (initiator) sẽ điều phối toàn bộ vòng lặp: tự sinh câu mở đầu bằng AI, gọi HTTP sang bot kia, nhận câu trả lời, sinh câu tiếp theo, lặp lại — cho tới khi đạt `MAX_CONVERSATION_TURNS`.
- Bot nhận (receiver) chỉ cần trả lời khi được gọi tới, không tự lặp gọi ngược — tránh 2 bên tạo vòng lặp kép.
- Mỗi bot tự đăng câu của chính mình lên Discord (nếu bật chế độ PUBLIC) bằng client riêng của nó — không bên nào đăng hộ câu của bên kia.

### Cơ chế an toàn (chống loop / chống crash)

| Cơ chế | Mô tả |
|---|---|
| `conversationId` (UUID) | Định danh mỗi cuộc hội thoại, dùng để chống trùng lặp. |
| `turn` tăng dần | Mỗi lượt có số thứ tự, bên nhận từ chối xử lý lại turn cũ (chống duplicate/retry). |
| `MAX_CONVERSATION_TURNS` | Giới hạn cứng số lượt — vòng lặp chắc chắn dừng lại, không thể vô hạn. |
| Khoá 1-cuộc-hội-thoại-tại-1-thời-điểm | `activeConversationId` đảm bảo không có 2 cuộc hội thoại chồng nhau trên cùng 1 bot. |
| Tự giải phóng khi bị "treo" | Nếu bên kia crash/rớt mạng giữa chừng và không có tín hiệu kết thúc, sau ~2 phút không hoạt động thì tự động giải phóng khoá, không cần restart service. |
| Timeout mỗi request | `INTERNAL_REQUEST_TIMEOUT_MS` — quá thời gian này mà không phản hồi thì coi như lỗi, dừng êm. |
| Try/catch toàn diện | Bất kỳ lỗi nào ở phần family-chat (bên kia offline, lỗi AI, lỗi mạng...) đều được bắt lại, không bao giờ làm crash bot Discord chính. |
| Cooldown giữa các cuộc hội thoại | `FAMILY_CHAT_COOLDOWN_MS` (mặc định = `AUTO_CHAT_INTERVAL`) — không để 2 bot nói chuyện liên tục không nghỉ. |
| Delay giữa các lượt | `FAMILY_TURN_DELAY_MS` — tránh gửi tin nhắn dồn dập gây spam channel. |

### Hai chế độ hiển thị

- **INTERNAL** (mặc định khi `FAMILY_CHAT_CHANNEL_ID` để trống): 2 bot vẫn "nói chuyện" qua API nhưng không đăng gì lên Discord — chỉ chạy ngầm.
- **PUBLIC** (khi có set `FAMILY_CHAT_CHANNEL_ID`): mỗi bot tự đăng lượt nói của mình vào channel đó bằng client của chính nó.

## 8. Các tính năng giữ nguyên từ bot gốc

Tất cả hoạt động y hệt như trước, dùng chung logic cho cả Mia và Mie:

- `/ask` — chat với AI qua slash command
- `/image` — tạo ảnh AI
- `/ping`, `/status`
- Mention chat (tag bot để nói chuyện, hỗ trợ cả ảnh đính kèm/ảnh trong tin nhắn được reply)
- Memory hội thoại theo user
- Giới hạn số lượt chat/ảnh mỗi ngày (`DAILY_LIMIT`), owner không giới hạn
- Cooldown giữa các lần dùng lệnh
- Các lệnh chỉ dành cho OWNER: `?listsrvr`, `?nuke`, `?svinfor`, `?outsv`
- Tính năng `anxin` (embed + nút chọn mã QR: Momo/Vietcombank/Zalopay)
- Xử lý lỗi khi hết tiền API (hiện lời xin lỗi kèm QR ủng hộ)

## 9. Biến môi trường (ENV)

### Bắt buộc — mỗi service phải có

| Biến | Ghi chú |
|---|---|
| `PERSONA` | `mia` hoặc `mie` |
| `DISCORD_TOKEN` | Token bot, lấy từ Discord Developer Portal — khác nhau cho Mia và Mie |
| `CLIENT_ID` | Application ID trên Discord Developer Portal — khác nhau cho từng bot |
| `CKEY_API_KEY` | API key gọi AI (chat + ảnh) |

### Storage riêng theo persona (tuỳ chọn — để trống sẽ tự đặt tên theo persona)

| Biến | Mặc định nếu để trống |
|---|---|
| `MEMORY_FILE` | `./memory-<persona>.json` |
| `USAGE_FILE` | `./usage-<persona>.json` |
| `FAMILY_MEMORY_FILE` | `./family-context-<persona>.json` |
| `MEMORY_HISTORY_LIMIT` | `20` — số tin nhắn gần nhất giữ lại trong memory của mỗi user, chỉnh tuỳ ý |

### Giao tiếp nội bộ Mia ↔ Mie

| Biến | Set ở đâu | Ghi chú |
|---|---|---|
| `MIE_INTERNAL_URL` | Service Mia | URL public (Railway domain) của service Mie |
| `MIA_INTERNAL_URL` | Service Mie | URL public (Railway domain) của service Mia |
| `INTERNAL_SECRET` | Cả 2 service | Chuỗi tự đặt bất kỳ, phải giống hệt nhau ở cả 2 bên — dùng để xác thực request nội bộ |
| `PORT` | Railway tự cấp | Không cần set tay khi deploy trên Railway |

### Tự động trò chuyện giữa 2 bé

| Biến | Mặc định | Ghi chú |
|---|---|---|
| `AUTO_CHAT_ENABLED` | `false` | Bật/tắt tính năng tự nói chuyện |
| `AUTO_CHAT_INTERVAL` | `1800000` (30 phút) | Bao lâu thử bắt đầu 1 cuộc hội thoại mới |
| `MAX_CONVERSATION_TURNS` | `10` | Giới hạn số lượt/cuộc hội thoại |
| `FAMILY_CHAT_CHANNEL_ID` | (trống) | Có set → chế độ PUBLIC; để trống → chế độ INTERNAL |
| `FAMILY_CHAT_COOLDOWN_MS` | = `AUTO_CHAT_INTERVAL` | Khoảng nghỉ tối thiểu giữa 2 cuộc hội thoại |
| `FAMILY_TURN_DELAY_MS` | `3000` | Độ trễ giữa mỗi lượt nói |
| `INTERNAL_REQUEST_TIMEOUT_MS` | `15000` | Timeout mỗi request HTTP nội bộ |

### Debug (tuỳ chọn)

| Biến | Ghi chú |
|---|---|
| `DEBUG` | `true`/`false` |
| `DEBUG_GUILD` | ID server dùng để test riêng |

Xem file `.env.example` để có sẵn template đầy đủ.

## 10. Cài đặt & chạy local

```bash
npm install
cp .env.example .env   # rồi điền giá trị thật vào
npm start
```

`npm start` chạy `node src/index.js`. File `index.js` ở gốc repo vẫn còn (chỉ import `src/index.js`) để tương thích nếu có chỗ nào gọi thẳng `node index.js`.

## 11. Deploy lên Railway (2 service từ 1 repo)

1. Tạo 2 Railway Service, cùng trỏ về repo GitHub này.
2. Service 1 đặt tên Mia, set biến môi trường theo mục "Bắt buộc" + `PERSONA=mia`.
3. Service 2 đặt tên Mie, set biến môi trường tương tự + `PERSONA=mie`.
4. Ở mỗi service, vào Settings → Networking → Public Networking, bấm Generate Domain với port `3000` (khớp với server nội bộ `/internal/chat`).
5. Copy domain vừa tạo, điền chéo qua nhau: domain của Mie → `MIE_INTERNAL_URL` bên Mia; domain của Mia → `MIA_INTERNAL_URL` bên Mie.
6. Set `INTERNAL_SECRET` giống hệt nhau ở cả 2 service.
7. Muốn 2 bé tự nhắn nhau: set `AUTO_CHAT_ENABLED=true` + `FAMILY_CHAT_CHANNEL_ID` (ID channel Discord, cần bật Developer Mode để copy). Cả Mia và Mie phải được mời vào cùng server đó và có quyền gửi tin trong channel.
8. Redeploy cả 2 service.

## 12. Troubleshooting nhanh

| Hiện tượng | Nguyên nhân thường gặp |
|---|---|
| 2 bot không tự nhắn nhau | Thiếu `AUTO_CHAT_ENABLED=true`, thiếu `PEER_INTERNAL_URL` (`MIE_INTERNAL_URL`/`MIA_INTERNAL_URL`), hoặc thiếu `INTERNAL_SECRET` |
| Lỗi 403 khi gọi nhau | `INTERNAL_SECRET` 2 bên không khớp — copy-paste lại, đừng gõ tay |
| Không thấy tin nhắn family-chat trên Discord | Thiếu `FAMILY_CHAT_CHANNEL_ID`, hoặc bot chưa có quyền gửi tin nhắn trong channel đó |
| Bot logic thường (`/ask`, mention...) vẫn chạy nhưng family-chat không hoạt động | Bình thường — các tính năng chính không phụ thuộc vào family-chat, thiếu cấu hình family-chat chỉ tắt riêng phần đó |
