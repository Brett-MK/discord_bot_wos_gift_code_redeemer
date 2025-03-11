import { GoogleSpreadsheet } from "google-spreadsheet";
import { JWT } from "google-auth-library";
import { config } from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import { chromium } from "playwright";

config();

const TOKEN = process.env.BOT_TOKEN;
const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n');;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});
// Function to get user IDs and names from Google Sheet
async function getUsersFromSheet() {
  try {
    const serviceAccountAuth = new JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

    await doc.loadInfo(); // Load the spreadsheet info

    const sheet = doc.sheetsByIndex[0]; // Assuming the first sheet contains user IDs and names
    const rows = await sheet.getRows();

    return rows.map((row) => ({
      userId: row.get("UserID"),
      username: row.get("Username"),
    }));
  } catch (error) {
    console.error("Error fetching Google Sheet:", error);
    return [];
  }
}

// Function to add a new user ID and name to Google Sheet
async function addUserToSheet(userId, username) {
  try {
    const serviceAccountAuth = new JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

    await doc.loadInfo(); // Load the sheet info

    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const existingUserIds = rows.map((row) => row.get("UserID"));
    if (existingUserIds.includes(userId)) {
      return `⚠️ User ID **${userId}** is already in the list!`;
    }

    await sheet.addRow({ UserID: userId, Username: username }); // Add both User ID and User Name
    return `✅ User ID **${userId}** (Name: **${username}**) has been added to the Google Sheet!`;
  } catch (error) {
    console.error("Error adding user to Google Sheet:", error);
    return `❌ Failed to add User ID **${userId}**: ${error.message}`;
  }
}

// Function to delete a user ID and their name from Google Sheet
async function deleteUserFromSheet(userId) {
  try {
    const serviceAccountAuth = new JWT({
      email: GOOGLE_CLIENT_EMAIL,
      key: GOOGLE_PRIVATE_KEY,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });

    const doc = new GoogleSpreadsheet(SHEET_ID, serviceAccountAuth);

    await doc.loadInfo(); // Load the sheet info

    const sheet = doc.sheetsByIndex[0];
    const rows = await sheet.getRows();

    const userRow = rows.find((row) => row.get("UserID") === userId);

    if (!userRow) {
      return `❌ User ID **${userId}** not found in the Google Sheet.`;
    }

    // Delete the row if found
    await userRow.delete();
    return `✅ User ID **${userId}** has been deleted from the Google Sheet.`;
  } catch (error) {
    console.error("Error deleting user from Google Sheet:", error);
    return `❌ Failed to delete User ID **${userId}**: ${error.message}`;
  }
}

// Function to log in and redeem for a given user ID with a gift code
async function redeemForUser(userId, username, giftCode) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    // Go to the URL
    await page.goto("https://wos-giftcode.centurygame.com/");

    // Loop through the data (assuming it's passed or fetched)
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

    // Click confirm and exit
    await page.locator(".confirm_btn").click();
    await page.locator(".exit_con").click();

    // Wait for 2 seconds before the next iteration
    await page.waitForTimeout(2000);

    await browser.close();
    return `✅ ${username}:${userId} - ${message}`;
  } catch (error) {
    await browser.close();
    return `❌ ${username}:${userId} - Failed to redeem code ${giftCode}, ${error.message}`;
  }
}

// Discord bot command handling
client.on("messageCreate", async (message) => {
  const args = message.content.split(" ");

  if (args[0] === "!redeem") {
    if (args.length < 2) {
      return message.reply(
        "⚠️ Please provide a gift code. Example: `redeem ABC123`"
      );
    }

    const giftCode = args[1]; // Extract the gift code
    message.reply(`🔄 Redeeming code **${giftCode}** for all users...`);

    const users = await getUsersFromSheet();
    if (users.length === 0) {
      return message.reply("❌ No users found in the Google Sheet!");
    }

    for (const user of users) {
      const result = await redeemForUser(user.userId, user.username, giftCode);
      await message.channel.send(result);
    }

    await message.channel.send("✅ Finished redeeming codes");
  } else if (args[0] === "!add") {
    if (args.length < 3) {
      return message.reply(
        "⚠️ Please provide both User ID and User Name. Example: `add 123456789 JohnDoe`"
      );
    }

    const userId = args[1]; // Extract the user ID
    const username = args[2]; // Extract the user name
    const result = await addUserToSheet(userId, username);
    message.reply(result);
  } else if (args[0] === "!delete") {
    if (args.length < 2) {
      return message.reply(
        "⚠️ Please provide a User ID to delete. Example: `delete 123456789`"
      );
    }

    const userId = args[1]; // Extract the user ID to delete
    const result = await deleteUserFromSheet(userId);
    message.reply(result);
  }
});

client.once("ready", () => {
  console.log(`Logged in as ${client.user.tag}!`);
});

client.login(TOKEN);
