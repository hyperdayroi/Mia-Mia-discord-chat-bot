import fs from "fs";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import persona from "../personas/index.js";
import { OWNER_ID } from "../config/env.js";
import { getMemory, pushMemoryEntry, saveMemory } from "../core/memory.js";
import { getUsageStatus, consumeUsage } from "../core/usage.js";
import { checkCooldown } from "../core/cooldown.js";
import { callChatModel } from "../core/aiClient.js";
import { stripThink, splitMessage } from "../core/text.js";
import { getFamilyContextMessage } from "../family/context.js";
import { triggerConversationNow } from "../family/conversationManager.js";
import { sendGreetingNow, debugScheduleInfo } from "../family/greetings.js";
import { isBlacklisted } from "../core/blacklist.js";
import { trackChannelMessage, getChannelContextMessage } from "../core/channelContext.js";
import { findMatch } from "../core/autoresponseStore.js";

export function registerMessageHandlers(client) {
  // ========= MENTION CHAT + OWNER TEXT COMMANDS + AUTORESPOND =========
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;

    // Âm thầm ghi nhận MỌI tin nhắn (không chỉ tin @ bot) để hiểu ngữ cảnh kênh —
    // KHÔNG dùng để tự động trả lời hay trigger bất cứ gì, chỉ để tham khảo sau này.
    trackChannelMessage(msg.channelId, msg.member?.displayName || msg.author.username, msg.content);

    // ============ AUTO-RESPOND — từ khoá do owner/admin tự cấu hình qua /autorespond ============
    if (msg.guildId && !isBlacklisted(msg.author.id)) {
      const match = findMatch(msg.guildId, msg.content);
      if (match) {
        if (match.image) {
          const embed = new EmbedBuilder().setColor("#00ccff").setDescription(match.response).setImage(match.image);
          msg.reply({ embeds: [embed] }).catch(() => {});
        } else {
          msg.reply(match.response).catch(() => {});
        }
        return;
      }
    }

    // ============ ?testgreeting <morning|night> — test gửi lời chào ngay, bỏ qua giờ/phiên ============
    if (msg.content.startsWith("?testgreeting")) {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const kind = msg.content.split(" ")[1] === "morning" ? "morning" : "night";
      await msg.reply(`⏳ Đang test gửi lời chào "${kind}" ngay (bỏ qua kiểm tra giờ/phiên)...`);

      const result = await sendGreetingNow(kind);
      if (result.ok) {
        return msg.reply("✅ Gửi thành công.");
      }
      return msg.reply(`❌ Gửi thất bại: ${result.reason}`);
    }

    // ============ ?greetinfo — xem hiện tại tính giờ/phiên ra sao ============
    if (msg.content === "?greetinfo") {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const info = debugScheduleInfo();
      return msg.reply(
`🕐 Giờ hiện tại (${info.dateKey}): ${info.hour}:${String(info.minute).padStart(2, "0")}
📅 Hôm nay tới phiên: **${info.todaysSender}**
🤖 Bot này là: **${persona.key}** ${info.todaysSender === persona.key ? "(ĐÚNG phiên hôm nay)" : "(chưa tới phiên hôm nay)"}`
      );
    }

    // ============ ?call<sibling> — owner kích hoạt family-chat ngay, không chờ scheduler ============
    // Tên lệnh tự sinh theo persona: bên Mia là "?callmie", bên Mie là "?callmia".
    if (msg.content === `?call${persona.sibling.key}`) {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const result = await triggerConversationNow();
      if (!result.ok) {
        return msg.reply(`😅 ${result.reason}`);
      }
      return msg.reply(`📞 Đang gọi ${persona.sibling.displayName} nói chuyện nè, chờ xíu bố ơi...`);
    }

    if (msg.content === "?listsrvr") {
      if (msg.author.id !== OWNER_ID) {
        return msg.reply("❌ Chỉ bố mới dùng được.");
      }

      const list = client.guilds.cache
        .map(g => `${g.name} | ${g.memberCount} members | ${g.id}`)
        .join("\n");

      fs.writeFileSync("guilds.txt", list);

      await msg.reply({
        content: persona.texts.listSrvr(client.guilds.cache.size),
        files: ["guilds.txt"]
      });

      return;
    }

    // ============?nuke=============
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

      await msg.channel.send(persona.texts.nukeOutro);
    }

    // =======?svinfor========
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

    // =======?outsv========
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

    const content = msg.content
      .replace(`<@${client.user.id}>`, "")
      .replace(`<@!${client.user.id}>`, "")
      .trim();

    if (!content) return;

    const uid = msg.author.id;

    if (isBlacklisted(uid)) return;

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

    pushMemoryEntry(uid, { role: "user", content: userContent });

    try {
      const channelContext = getChannelContextMessage(msg.channelId);
      const reply = await callChatModel([
        { role: "system", content: persona.systemPrompt(uid, msg.guild) },
        { role: "system", content: getFamilyContextMessage() },
        ...(channelContext ? [{ role: "system", content: channelContext }] : []),
        ...chat
      ]);
      const finalReply = stripThink(reply || "Lag.") || "Lag.";
      pushMemoryEntry(uid, { role: "assistant", content: finalReply });
      saveMemory();
      consumeUsage("chat", uid);

      const parts = splitMessage(finalReply);
      await msg.reply(parts[0]);
      for (let i = 1; i < parts.length; i++) {
        await msg.channel.send(parts[i]);
      }
    } catch (err) {
      if (
        err.message?.includes("402") ||
        err.message?.includes("balance") ||
        err.message?.includes("insufficient")
      ) {
        return msg.reply(persona.texts.apiErrorApology);
      }

      console.error(err);
      msg.reply(persona.texts.apiErrorApology);
    }
  });

  // ========= ABOUTSIVI (chỉ Mia, không áp dụng cho Mie) =========
  client.on("messageCreate", async msg => {
    if (msg.author.bot) return;

    if (persona.key === "mia" && msg.content.toLowerCase().trim() === "aboutsivi") {
      await msg.reply(
`╭・🌟———————————🌟・╮
# ༒ Lục Địa Aether ༒
╰・🌻———————————🌻・╯
**\`GIỚI THIỆU:\`**

•┈────────────┈•
⏤͟͟͞͞ ⊰Xin chào và chào mừng bạn đến với **Lục Địa Aether**, nơi mà bạn sẽ tiến bước vào 1 cuộc hành trình lấy bối cảnh Fantasy quen thuộc đầy rộng lớn, huyền ảo và nhiều thứ khác đang chờ đợi bạn khám phá! Nay đã chính thức mở ra để chào các Dũng Giả mới hoặc các Cộng Đồng có chung chí hướng, mong muốn giao lưu, phát triển và hỗ trợ lẫn nhau⊱
•┈────────────┈•


 **\`Vùng đất này có gì cho bạn khám phá?\`**

-  🏰**【Chủ Đề Fantasy】** — Vì chủ đề server là phong cách Fantasy nên gần như mọi hệ thống từ kênh, levels... đều mang chủ đề này
-  🎮**【Đa Dạng Game】** — Server chơi đa dạng các thể loại game từ Valorant, Liên quân, Genshin v.v... đặc biệt còn có cả kênh cho phép bạn chiêu mộ những người đồng đội có chí hướng leo rank hoặc đơn giản là tấu hài
-  📜**【Hệ Thống Uỷ Thác】** — Nơi mà bạn nhận nhiệm vụ và hoàn thành chúng trước những kẻ khác! Tuỳ theo cấp độ, độ khó phần thưởng sẽ càng cao và quý giá!
-  🎊**【Events & Giveaways】** —  Events gần như mỗi tuần! (đã tạm hoãn, xl vì sự bất tiện này)

**\`Và còn nhiều thứ khác nữa!!\`**

**「**Sau khi kết minh (Partner) thành công, thông tin về server của bên bạn sẽ được trưng bày tại khu vực **Đồng Minh**, đồng thời bên mình cũng mong nhận được sự hỗ trợ tương tự từ bên phía bạn! Xin trân thành cảm ơn.**」**

 **Kính chúc chư vị đạo vận hành thông, bằng hữu tứ phương.** 🧭
🔗: https://discord.gg/jAMSEGH8Ua 
[**\`Khám phá ngay!\`**](https://cdn.imgchest.com/files/7e50433c2b32.gif)`
      );
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
}
