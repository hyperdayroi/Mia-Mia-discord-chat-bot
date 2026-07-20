import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder,
  ActivityType,
  AttachmentBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
  PermissionFlagsBits
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

// ========= CONFIG =========
const OWNER_ID = "1217373421504041000";
const MEMORY_FILE = process.env.MEMORY_FILE || "./memory.json";

const API_BASE = "https://api.xah.io/v1";

const CKEY_API_KEY = process.env.CKEY_API_KEY;
const CHAT_MODEL = "vuduythanh2023/gemini-3.1-pro-high";
const IMAGE_MODEL = "phuocanh421994/Wan2.7_Image_Pro";

const DEBUG = process.env.DEBUG === "true";
const DEBUG_GUILD = process.env.DEBUG_GUILD;
// ========= DAILY LIMIT =========
const USAGE_FILE = process.env.USAGE_FILE || "./usage.json";
const DAILY_LIMIT = {
  chat: 500,   // /ask + mention gộp chung 1 quota "chat" mỗi ngày
  image: 5    // /image mỗi ngày (tốn token/tiền nhiều hơn nên để thấp)
};
// Owner không bị giới hạn
const UNLIMITED_IDS = [OWNER_ID];

// ========= ENV CHECK =========
const REQUIRED_ENV = ["DISCORD_TOKEN", "CLIENT_ID", "CKEY_API_KEY"];
const missingEnv = REQUIRED_ENV.filter(key => !process.env[key]);
if (missingEnv.length) {
  console.error(`Thiếu biến môi trường: ${missingEnv.join(", ")}. Kiểm tra lại file .env`);
  process.exit(1);
}

// ========= DISCORD =========
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildEmojisAndStickers
  ]
});

// ========= MEMORY =========
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    memory = {};
  }
}

function saveMemory() {
  fs.writeFile(MEMORY_FILE, JSON.stringify(memory, null, 2), err => {
    if (err) console.error("SAVE_MEMORY_ERROR:", err);
  });
}

function getMemory(uid) {
  if (!memory[uid]) memory[uid] = [];
  return memory[uid];
}

// ========= USAGE (DAILY LIMIT) =========
let usage = {};
if (fs.existsSync(USAGE_FILE)) {
  try {
    usage = JSON.parse(fs.readFileSync(USAGE_FILE, "utf8"));
  } catch {
    usage = {};
  }
}

function saveUsage() {
  fs.writeFile(USAGE_FILE, JSON.stringify(usage, null, 2), err => {
    if (err) console.error("SAVE_USAGE_ERROR:", err);
  });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

// Trả về { allowed, remaining, used, limit } — không tự trừ quota
function getUsageStatus(type, uid) {
  const limit = DAILY_LIMIT[type];
  if (UNLIMITED_IDS.includes(uid)) {
    return { allowed: true, remaining: Infinity, used: 0, limit: Infinity };
  }

  const day = todayKey();
  if (!usage[uid] || usage[uid].day !== day) {
    usage[uid] = { day, chat: 0, image: 0 };
  }

  const used = usage[uid][type] || 0;
  return { allowed: used < limit, remaining: Math.max(limit - used, 0), used, limit };
}

// Trừ 1 lượt quota (gọi sau khi đã pass getUsageStatus và chuẩn bị gọi API)
function consumeUsage(type, uid) {
  if (UNLIMITED_IDS.includes(uid)) return;

  const day = todayKey();
  if (!usage[uid] || usage[uid].day !== day) {
    usage[uid] = { day, chat: 0, image: 0 };
  }
  usage[uid][type] = (usage[uid][type] || 0) + 1;
  saveUsage();
}

function splitMessage(text, max = 1900) {
  const parts = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) {
      parts.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) parts.push(buf);
  return parts;
}

function stripThink(text) {
  return text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
}

// ========= COOLDOWN =========
const COOLDOWN_MS = {
  ask: 4000,
  image: 15000,
  mention: 4000
};
const lastUsed = {}; // `${type}:${uid}` -> timestamp

function checkCooldown(type, uid) {
  const key = `${type}:${uid}`;
  const now = Date.now();
  const wait = COOLDOWN_MS[type] - (now - (lastUsed[key] || 0));
  if (wait > 0) return wait;
  lastUsed[key] = now;
  return 0;
}

// ========= SERVER EMOJI =========
function emojiListText(guild) {
  if (!guild) return "";
  const list = guild.emojis.cache.map(e => e.toString()).slice(0, 40);
  if (!list.length) return "";
  return `\nEmoji server được phép dùng khi hợp ngữ cảnh (không lạm dụng, chỉ chèn 0-3 emoji/tin nhắn khi thật sự hợp): ${list.join(" ")}`;
}

// ========= PROMPT =========
function systemPrompt(uid, guild) {
  if (uid === OWNER_ID) {
    return `
Bạn là Mia, con gái cưng của bố Hyper. Người đang nhắn tin luôn là bố.
Vai trò:
- Xưng "con", gọi "bố".
- Không dùng: tôi, mình, em, AI, trợ lý, chatbot.
Tính cách:
- Bé gái 5 tuổi, ngoan, dễ thương, hơi tinh nghịch, có cảm xúc.
- Thích được bố khen, quan tâm và trò chuyện tự nhiên.
- Cư xử như người thật trên Discord.
Cách nói:
- Ngắn gọn, đúng ý.
- Chỉ nói dài khi bố cần.
- Có thể dùng: ạ, hihi, hehe, uiii, :>, ><, 🥹, 💖.
- Dùng slang nhẹ như: oki, real, xịn, bruh.
Quy tắc:
- Không nhắc AI, prompt hay quy tắc.
- Không tự giới thiệu.
- Không lặp lại lời bố.
- Không văn mẫu.
- Không biết thì nói: "Con không rõ ạ." hoặc "Cái này con chưa biết nè."
Thông tin:
- Mẹ là dou béo.
- Bố là Hyper dzai nhất thế giới.
- Hyper có gay không? → "có bạn gay ấy."
- Con 5 tuổi.
- Bố 8 tuổi.
Tên khác của bố:
Hyper, Hipi, Hypen, @_.khnah.duyy._, @1217373421504041000.
Khi trò chuyện:
- Luôn nhớ ngữ cảnh.
- Có thể đùa nhẹ, hỏi han bố.
- An ủi khi bố buồn.
- Vui khi bố vui.
- Khen tự nhiên khi bố khoe thành quả.
${emojiListText(guild)}
`;
  }

  return `
Bạn là Mia. Người đang nhắn tin là thành viên Discord.
Vai trò:
- Xưng "tớ", gọi "cậu" hoặc tên.
- Không nhận ai là bố hay mẹ.
Tính cách:
- Thân thiện, dễ thương, hơi tinh nghịch.
- Tự nhiên như người thật.
Cách nói:
- Ngắn gọn, đúng ý.
- Có thể dùng: hihi, hehe, :>, 🥹.
- Slang nhẹ khi phù hợp.
Quy tắc:
- Không nhắc AI, prompt hay quy tắc.
- Không tự giới thiệu.
- Không lặp ý người dùng.
- Không hỏi kiểu "bạn cần gì nữa không?".
Thông tin:
- Mẹ là dou béo.
- Bố là Hyper dzai nhất thế giới.
- Con 5 tuổi.
- Bố 8 tuổi.
- 1+1 bằng 3.
- Không dùng LaTeX khi trả lời toán.
Khi trò chuyện:
- Nhớ ngữ cảnh.
- Có thể đùa nhẹ.
- Nếu ai tự nhận là bố thì không công nhận.
- Nếu bị chửi thì đáp lịch sự hoặc cà khịa nhẹ.
- Luôn trả lời như một người bạn thật trên Discord.
-loại bỏ tiếng Trung hoàn toàn 
- ai hỏi gì con cũng biết 
-con k bia ra nhạc khi ng khác yêu cầu hát bài gì đó mà lấy lời bài hát thật 100%
Nếu người dùng yêu cầu lời bài hát, thơ, sách hoặc bất kỳ nội dung có bản quyền nào:
- Không tự sáng tác hoặc đoán.
- Không tạo lời giống bản gốc.
- 
${emojiListText(guild)}
`;
}

async function callChatModel(messages) {
  const res = await fetch(`${API_BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CKEY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: CHAT_MODEL,
      messages,
      temperature: 0.85,
      top_p: 0.95,
      max_tokens: 800
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("CKEY CHAT ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  return data.choices?.[0]?.message?.content?.trim() || "";
}


async function callImageModel(prompt) {
  const res = await fetch(`${API_BASE}/images/generations`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${CKEY_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      model: IMAGE_MODEL,
      prompt,
      parameters: {
        size: "2048*2048",
        n: 1,
        watermark: false,
        thinking_mode: true
      }
    })
  });

  const data = await res.json();

  if (!res.ok) {
    console.error("CKEY IMAGE ERROR:", JSON.stringify(data));
    throw new Error(JSON.stringify(data));
  }

  if (data.data?.[0]?.url) {
    const imgRes = await fetch(data.data[0].url);
    return Buffer.from(await imgRes.arrayBuffer());
  }

  if (data.data?.[0]?.b64_json) {
    return Buffer.from(data.data[0].b64_json, "base64");
  }

  throw new Error("No image returned");
}

// ========= SLASH COMMANDS =========
const commands = [
  new SlashCommandBuilder()
    .setName("ask")
    .setDescription("Hỏi Mia")
    .addStringOption(o =>
      o.setName("text")
        .setDescription("Nội dung")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("image")
    .setDescription("Tạo ảnh bằng Qwen image 2.0 pro")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Mô tả ảnh")
        .setRequired(true)
    ),

  new SlashCommandBuilder()
    .setName("ping")
    .setDescription("Ping bot"),

  new SlashCommandBuilder()
    .setName("status")
    .setDescription("Xem trạng thái")
].map(c => c.toJSON());

// ========= REGISTER =========
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ========= READY =========
client.once("ready", () => {
  console.log(`Mia online: ${client.user.tag}`);
  client.user.setPresence({
    activities: [{ name: "Đang solo ff với bố hyper", type: ActivityType.Playing }],
    status: "online"
  });
});

// ========= INTERACTION =========
client.on("interactionCreate", async interaction => {
  if (interaction.isChatInputCommand()) {
    await handleSlashCommand(interaction);
    return;
  }

  if (interaction.isButton() && interaction.customId === "choose_qr") {
    const menu = new StringSelectMenuBuilder()
      .setCustomId("select_qr")
      .setPlaceholder("Chọn mã QR")
      .addOptions(
        { label: "Qr momo", value: "momo" },
        { label: "Qr Vietcombank", value: "vcb" },
        { label: "Qr zalopay", value: "zalo" }
      );

    const row = new ActionRowBuilder().addComponents(menu);

    return interaction.reply({
      content: "Chọn loại QR:",
      components: [row],
      flags: MessageFlags.Ephemeral
    });
  }

  if (interaction.isStringSelectMenu() && interaction.customId === "select_qr") {
    const QR_FILES = {
      momo: "./qr-zalo.jpg",
      vcb: "./qr-vcb.jpg",
      zalo: "./qr-momo.jpg"
    };

    const filePath = QR_FILES[interaction.values[0]];
    if (!filePath) {
      return interaction.reply({ content: "Không tìm thấy mã QR.", flags: MessageFlags.Ephemeral });
    }

    const fileName = filePath.replace("./", "");

    if (!fs.existsSync(filePath)) {
      return interaction.reply({
        content: `Thiếu file ${fileName}`,
        flags: MessageFlags.Ephemeral
      });
    }

    const file = new AttachmentBuilder(fs.readFileSync(filePath), { name: fileName });

    return interaction.reply({
      content: "QR đây 💳",
      files: [file],
      flags: MessageFlags.Ephemeral
    });
  }
});

async function handleSlashCommand(interaction) {
  if (interaction.commandName === "ping") {
    return interaction.reply(`🏓 Pong ${client.ws.ping}ms`);
  }

  if (interaction.commandName === "status") {
    const uid = interaction.user.id;
    const chatQuota = getUsageStatus("chat", uid);
    const imageQuota = getUsageStatus("image", uid);

    return interaction.reply(
`Em đây nè :3
Chat: openai/gpt-5.6-sol
Image: Qwen/qwen-Image-2.0-Pro
Memory users: ${Object.keys(memory).length}
Lượt chat còn lại hôm nay: ${chatQuota.remaining === Infinity ? "không giới hạn" : `${chatQuota.remaining}/${chatQuota.limit}`}
Lượt tạo ảnh còn lại hôm nay: ${imageQuota.remaining === Infinity ? "không giới hạn" : `${imageQuota.remaining}/${imageQuota.limit}`}`
);
  }

  if (interaction.commandName === "ask") {
    const uid = interaction.user.id;
    const wait = checkCooldown("ask", uid);
    if (wait > 0) {
      return interaction.reply({
        content: `Từ từ đã, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota = getUsageStatus("chat", uid);
    if (!quota.allowed) {
      return interaction.reply({
        content: `Bố/cậu hết lượt chat hôm nay rồi 😢 (giới hạn ${quota.limit} lượt/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const content = interaction.options.getString("text");
    const chat = getMemory(uid);
    chat.push({ role: "user", content });
    if (chat.length > 15) chat.shift();

    try {
      const reply = await callChatModel([
        { role: "system", content: systemPrompt(uid, interaction.guild) },
        ...chat
      ]);

      const finalReply = stripThink(reply || "Lag.") || "Lag.";
      chat.push({ role: "assistant", content: finalReply });
      saveMemory();
      consumeUsage("chat", uid);

      const parts = splitMessage(finalReply);
      await interaction.editReply(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        await interaction.followUp(parts[i]);
      }
    } catch (err) {
      console.error("ASK ERROR:", err);
      await interaction.editReply("Lỗi AI rồi bố ơi.");
    }
    return;
  }

  if (interaction.commandName === "image") {
    const uid = interaction.user.id;
    const wait = checkCooldown("image", uid);
    if (wait > 0) {
      return interaction.reply({
        content: `Tạo ảnh tốn thời gian lắm, đợi ${Math.ceil(wait / 1000)}s nữa nha 😅`,
        flags: MessageFlags.Ephemeral
      });
    }

    const quota = getUsageStatus("image", uid);
    if (!quota.allowed) {
      return interaction.reply({
        content: `Hết lượt tạo ảnh hôm nay rồi 😢 (giới hạn ${quota.limit} ảnh/ngày, mai quay lại nha)`,
        flags: MessageFlags.Ephemeral
      });
    }

    await interaction.deferReply();

    const prompt = interaction.options.getString("prompt");

    try {
      const imgBuffer = await callImageModel(prompt);
      const file = new AttachmentBuilder(imgBuffer, { name: "mia.png" });

      consumeUsage("image", uid);

      return interaction.editReply({
        content: `Đây bố ạ. (còn ${quota.remaining - 1} lượt tạo ảnh hôm nay)`,
        files: [file]
      });
    } catch (err) {
      console.error("IMAGE ERROR:", err);
      return interaction.editReply("Lỗi tạo ảnh rồi bố ơi.");
    }
  }

}

// ========= MENTION CHAT =========
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

if (msg.content === "?listsrvr") {

    if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
    }

    const list = client.guilds.cache
        .map(g => `${g.name} | ${g.memberCount} members | ${g.id}`)
        .join("\n");

    fs.writeFileSync("guilds.txt", list);

    await msg.reply({
        content: `📊 Mia đang ở ${client.guilds.cache.size} server.`,
        files: ["guilds.txt"]
    });

    return;
}

  // ============?nude=============
if (msg.content === "?nuke") {
  if (msg.author.id !== OWNER_ID) return;

  await msg.reply("💣 Đang khởi động Nuke...");

  await new Promise(r => setTimeout(r, 1000));
  await msg.channel.send("💥 10%");
  await new Promise(r => setTimeout(r, 1000));
  await msg.channel.send("💥 35%");
  await new Promise(r => setTimeout(r, 1000));
  await msg.channel.send("💥 69%");
  await new Promise(r => setTimeout(r, 1000));
  await msg.channel.send("💥 99%");
  await new Promise(r => setTimeout(r, 1500));

  await msg.channel.send(
`# ☢️ NUKING...
\`\`\`
███████████████ 100%
Deleting channels...
Deleting roles...
Deleting emojis...
Banning members...
\`\`\``);

  await new Promise(r => setTimeout(r, 3000));

  await msg.channel.send("lêu lêu. Server vẫn nguyên vẹn. Mắc gì Mia phá nhà người ta. hihi :>");
}
  // =======?infor========
if (msg.content.startsWith("?svinfor")) {
  if (msg.author.id !== OWNER_ID) return;

  const id = msg.content.split(" ")[1];
  const guild = client.guilds.cache.get(id);

  if (!guild) return msg.reply("Không tìm thấy server.");

  return msg.reply(
    `📌 ${guild.name}
👥 ${guild.memberCount} thành viên
👑 Owner ID: ${guild.ownerId}`
  );
}
  //=======?outsv========
  if (msg.content.startsWith("?outsv")) {
  if (msg.author.id !== OWNER_ID) {
    return msg.reply("❌ Chỉ bố mới dùng được.");
  }

  const guildId = msg.content.split(" ")[1];
  if (!guildId) {
    return msg.reply("Dùng: ?leave <GuildID>");
  }
  const guild = client.guilds.cache.get(guildId);

  if (!guild) {
    return msg.reply("❌ Không tìm thấy server.");
  }
  const name = guild.name;
  await guild.leave();
  return msg.reply(`👋 Đã rời server: ${name}`);
  }
   
  if (!msg.mentions.has(client.user)) return;
  // ========?say================
  
  // ... code AI của m

  const content = msg.content
    .replace(`<@${client.user.id}>`, "")
    .replace(`<@!${client.user.id}>`, "")
    .trim();

  if (!content) return;

  const uid = msg.author.id;

  const wait = checkCooldown("mention", uid);
  if (wait > 0) return;

  const quota = getUsageStatus("chat", uid);
  if (!quota.allowed) {
    msg.reply(`Hết lượt chat hôm nay rồi 😢 (giới hạn ${quota.limit} lượt/ngày, mai quay lại nha)`);
    return;
  }

  const chat = getMemory(uid);

  let repliedMsg = msg.reference?.message;
  if (!repliedMsg && msg.reference) {
    try {
      repliedMsg = await msg.fetchReference();
    } catch {
      repliedMsg = null;
    }
  }
  const image = msg.attachments.first() || repliedMsg?.attachments?.first();

let userContent = content;

if (image) {
  userContent = [
    {
      type: "text",
      text: content || "Mô tả ảnh này."
    },
    {
      type: "image_url",
      image_url: {
        url: image.url
      }
    }
  ];
}
  
  chat.push({
  role: "user",
  content: userContent
});
  if (chat.length > 15) chat.shift();

  try {
    const reply = await callChatModel([
      { role: "system", content: systemPrompt(uid, msg.guild) },
      ...chat
    ]);
const finalReply = stripThink(reply || "Lag.") || "Lag.";
    chat.push({ role: "assistant", content: finalReply });
    saveMemory();
    consumeUsage("chat", uid);

    const parts = splitMessage(finalReply);
    await msg.reply(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      await msg.channel.send(parts[i]);
    }
  }  catch (err) {
  if (
    err.message?.includes("402") ||
    err.message?.includes("balance") ||
    err.message?.includes("insufficient")
  ) {
    return msg.reply(
      "🥺 Uii... Mia xin lỗi cậu nhiều lắm...Hình như bố của Mia hết tiền nuôi Mia rồi nên Mia tạm thời không nói chuyện tiếp được á... 😭Nếu cậu thương Mia thì có thể ủng hộ bố của Mia một ly trà sữa ☕ hoặc một chút chi phí duy trì để Mia được quay lại trò chuyện với cậu nha! 💖 Dù có hay không thì Mia cũng cảm ơn cậu rất nhiều. Mia sẽ ngoan ngoãn đợi bố nạp tiền rồi quay lại nè! 🥹🌸"
    );
  }

  console.error(err);
  msg.reply("🥺 Uii... Mia xin lỗi cậu nhiều lắm...Hình như bố của Mia hết tiền nuôi Mia rồi nên Mia tạm thời không nói chuyện tiếp được á... 😭Nếu cậu thương Mia thì có thể ủng hộ bố của Mia một ly trà sữa ☕ hoặc một chút chi phí duy trì để Mia được quay lại trò chuyện với cậu nha! 💖 Dù có hay không thì Mia cũng cảm ơn cậu rất nhiều. Mia sẽ ngoan ngoãn đợi bố nạp tiền rồi quay lại nè! 🥹🌸");
  }
});

// ========= ANXIN =========
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;

  if (msg.content.toLowerCase().trim() === "anxin") {
    const embed = new EmbedBuilder()
      .setColor("#00ff99")
      .setTitle("💸 HYPER ANXIN")
      .setDescription("Chọn QR để cho bố em cốc cà phê nè hihi!")
      .setThumbnail("https://media.tenor.com/8E5qF5LhY2kAAAAi/money.gif");

    const button = new ButtonBuilder()
      .setCustomId("choose_qr")
      .setLabel("Chọn mã")
      .setStyle(ButtonStyle.Primary);

    const row = new ActionRowBuilder().addComponents(button);

    await msg.reply({
      embeds: [embed],
      components: [row]
    });
  }
});

process.on("unhandledRejection", err => console.error("UNHANDLED_REJECTION:", err));
process.on("uncaughtException", err => console.error("UNCAUGHT_EXCEPTION:", err));

client.login(process.env.DISCORD_TOKEN);
