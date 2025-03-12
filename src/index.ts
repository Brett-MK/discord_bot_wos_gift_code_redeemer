import { config } from "dotenv";
import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { chromium } from "playwright";
import {
  addUserToSheet,
  createGuildSheet,
  deleteUserFromSheet,
  getUsersFromSheet,
} from "./google-sheets.js";
import { redeemForUser } from "./redeem-helper.js";
import {
  ADD_HELP_MESSAGE,
  DELETE_HELP_MESSAGE,
  HELP_MESSAGE,
  LIST_HELP_MESSAGE,
  REDEEM_HELP_MESSAGE,
} from "./help-messages.const.js";
import pLimit from "p-limit";

config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

const limit = pLimit(5);

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

function chunk(array: any[], size: number): any[][] {
  const chunks: any[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

async function handleRedeemMessage(
  message: Message,
  guildId: string,
  giftCode: string
): Promise<string> {
  const users = await getUsersFromSheet(guildId);
  if (users.length === 0) {
    return "❌ No users found!";
  }

  const browser = await chromium.launch({ headless: true });

  const userBatches = chunk(users, 10);

  try {
    for (const batch of userBatches) {
      const redeemPromises = batch.map(async (user) => {
        const { userId, username } = user;
        const result = await limit(() =>
          redeemForUser(userId, username, giftCode, browser)
        );
        await (message.channel as TextChannel).send(result);
      });

      await Promise.all(redeemPromises);
    }

    return "✅ Finished redeeming codes";
  } catch (error) {
    console.error("Error handling redeem message:", error);
    return "❌ An error occurred while redeeming codes.";
  } finally {
    await browser.close();
  }
}

async function handleListUsers(message: Message, guildId: string) {
  const users = await getUsersFromSheet(guildId);

  if (users.length === 0) {
    return message.reply("❌ No users found!");
  }

  const userList = users
    .map((user) => `${user.username}:${user.userId}`)
    .join("\n");

  // Split the user list into chunks of 2000 characters (discord max message size)
  const chunkSize = 2000;
  let chunkStart = 0;

  while (chunkStart < userList.length) {
    let chunkEnd = chunkStart + chunkSize;

    // Ensure chunk does not cut off a username by looking back at the last new line
    if (chunkEnd < userList.length) {
      // Find the last newline within the chunk size
      const lastNewLine = userList.lastIndexOf("\n", chunkEnd);
      if (lastNewLine > chunkStart) {
        chunkEnd = lastNewLine; // Adjust chunk end to avoid cutting off username
      }
    }

    const chunk = userList.slice(chunkStart, chunkEnd);
    await (message.channel as TextChannel).send(chunk);
    chunkStart = chunkEnd; // Move the start of the next chunk
  }
}

discordClient.on("messageCreate", async (message: Message) => {
  if (!message.guild || message.author.bot) return; // Ignore bot messages

  const guildId = message.guild.id;

  const args = message.content.split(" ");

  switch (args[0]) {
    case "!redeem": {
      if (args.length != 2) {
        return message.reply(REDEEM_HELP_MESSAGE);
      }
      const giftCode = args[1];

      message.reply(`🔄 Redeeming code **${giftCode}** for all users...`);

      const result = await handleRedeemMessage(message, guildId, giftCode);

      message.reply(result);
      break;
    }

    case "!add": {
      if (args.length != 3 || isNaN(parseInt(args[1]))) {
        return message.reply(ADD_HELP_MESSAGE);
      }

      const result = await addUserToSheet(guildId, args[1], args[2]);
      message.reply(result);
      break;
    }

    case "!delete": {
      if (args.length != 2) {
        return message.reply(DELETE_HELP_MESSAGE);
      }

      const result = await deleteUserFromSheet(guildId, args[1]);
      message.reply(result);
      break;
    }

    case "!list": {
      if (args.length != 1) {
        return message.reply(LIST_HELP_MESSAGE);
      }

      await handleListUsers(message, guildId);
      break;
    }

    case "!help": {
      if (args.length != 1) {
        return message.reply(HELP_MESSAGE);
      }

      const helpMessages = [
        LIST_HELP_MESSAGE,
        ADD_HELP_MESSAGE,
        DELETE_HELP_MESSAGE,
        REDEEM_HELP_MESSAGE,
      ];

      message.reply(helpMessages.join("\n"));
      break;
    }

    default: {
      break;
    }
  }
});

discordClient.once("ready", async () => {
  console.log(`Logged in as ${discordClient.user?.tag}!`);

  for (const guild of discordClient.guilds.cache.values()) {
    await createGuildSheet(guild.id, guild.name);
  }
});

/**
 * When the bot joins a new server, create a new Google Sheet tab for it.
 */
discordClient.on("guildCreate", async (guild) => {
  console.log(`📌 Joined new server: ${guild.name} (${guild.id})`);
  await createGuildSheet(guild.id, guild.name);
});

discordClient.login(DISCORD_BOT_TOKEN);
