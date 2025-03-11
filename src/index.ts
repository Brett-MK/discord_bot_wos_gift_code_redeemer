import { config } from "dotenv";
import { Client, GatewayIntentBits, Message, TextChannel } from "discord.js";
import { chromium, Page } from "playwright";
import {
  addUserToSheet,
  deleteUserFromSheet,
  getUsersFromSheet,
} from "./google-sheets.js";

config();

const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN!;

const discordClient = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

// Function to log in and redeem for a given user ID with a gift code
async function redeemForUser(
  userId: string,
  username: string,
  giftCode: string
): Promise<string> {
  const browser = await chromium.launch({ headless: true });
  const page: Page = await browser.newPage();

  try {
    // Go to the URL
    await page.goto("https://wos-giftcode.centurygame.com/");

    // Fill the player ID
    await page.fill('input[placeholder="Player ID"]', userId);

    // Click login button
    const loginBtn = page.locator(".login_btn");
    await loginBtn.click();

    // Ensure login button disappears after login
    await page.waitForSelector(".login_btn", { state: "hidden" });

    // Fill in the gift code
    await page.fill('input[placeholder="Enter Gift Code"]', giftCode);

    // Click the redeem button
    await page.locator(".exchange_btn").click();

    // Get the message
    const message = await page.locator(".msg").textContent();

    // // Click confirm and exit
    // await page.locator(".confirm_btn").click();
    // await page.locator(".exit_con").click();

    // // Wait for 2 seconds before the next iteration
    // await page.waitForTimeout(2000);

    await browser.close();
    return `✅ ${username}:${userId} - ${message}`;
  } catch (error) {
    await browser.close();
    console.error(
      `Error redeeming code for user ${username}:${userId} from Google Sheet:`,
      error
    );
    return `❌ ${username}:${userId} - Failed to redeem code ${giftCode}, ${error}`;
  }
}

discordClient.on("messageCreate", async (message: Message) => {
  const args = message.content.split(" ");

  switch (args[0]) {
    case "!redeem":
      if (args.length != 2) {
        return message.reply("⚠️ Usage: `!redeem <giftcode>");
      }

      const giftCode = args[1]; // Extract the gift code
      message.reply(`🔄 Redeeming code **${giftCode}** for all users...`);

      const users = await getUsersFromSheet();
      if (users.length === 0) {
        return message.reply("❌ No users found in the Google Sheet!");
      }

      for (const user of users) {
        const redeemResult = await redeemForUser(
          user.userId,
          user.username,
          giftCode
        );

        await (message.channel as TextChannel).send(redeemResult);
      }

      message.reply("✅ Finished redeeming codes");
      break;

    case "!add":
      if (args.length != 3) {
        return message.reply(
          "⚠️ Usage: `!add <userId> <username> (no spaces in username)`"
        );
      }

      const addResult = await addUserToSheet(args[1], args[2]);
      message.reply(addResult);
      break;

    case "!delete":
      if (args.length != 2) {
        return message.reply("⚠️ Usage: `!delete <userId>`");
      }

      const deleteResult = await deleteUserFromSheet(args[1]);
      message.reply(deleteResult);
      break;

    default:
      break;
  }
});

discordClient.once("ready", () => {
  console.log(`Logged in as ${discordClient.user?.tag}!`);
});

discordClient.login(DISCORD_BOT_TOKEN);
