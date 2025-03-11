var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { config } from "dotenv";
import { Client, GatewayIntentBits } from "discord.js";
import { chromium } from "playwright";
import { addUserToSheet, createGuildSheet, deleteUserFromSheet, getUsersFromSheet, } from "./google-sheets.js";
config();
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
// Function to log in and redeem for a given user ID with a gift code
function redeemForUser(userId, username, giftCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const browser = yield chromium.launch({ headless: true });
        const page = yield browser.newPage();
        try {
            // Go to the URL
            yield page.goto("https://wos-giftcode.centurygame.com/");
            // Fill the player ID
            yield page.fill('input[placeholder="Player ID"]', userId);
            // Click login button
            const loginBtn = page.locator(".login_btn");
            yield loginBtn.click();
            try {
                // Ensure login button disappears after login
                yield page.waitForSelector(".login_btn", {
                    state: "hidden",
                    timeout: 5000,
                });
            }
            catch (error) {
                return `❌ ${username}:${userId} - check UserID, timed out logging in.`;
            }
            // Fill in the gift code
            yield page.fill('input[placeholder="Enter Gift Code"]', giftCode);
            // Click the redeem button
            yield page.locator(".exchange_btn").click();
            // Get the message
            const message = yield page.locator(".msg").textContent();
            yield browser.close();
            return `✅ ${username}:${userId} - ${message}`;
        }
        catch (error) {
            yield browser.close();
            console.error(`Error redeeming code for user ${username}:${userId} from Google Sheet:`, error);
            return `❌ ${username}:${userId} - Failed to redeem code ${giftCode}, ${error}`;
        }
    });
}
discordClient.on("messageCreate", (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (!message.guild || message.author.bot)
        return; // Ignore bot messages
    const guildId = message.guild.id;
    const args = message.content.split(" ");
    switch (args[0]) {
        case "!redeem":
            if (args.length != 2) {
                return message.reply("⚠️ Usage: `!redeem <giftcode>");
            }
            const giftCode = args[1]; // Extract the gift code
            message.reply(`🔄 Redeeming code **${giftCode}** for all users...`);
            const users = yield getUsersFromSheet(guildId);
            if (users.length === 0) {
                return message.reply("❌ No users found in the Google Sheet!");
            }
            for (const user of users) {
                const redeemResult = yield redeemForUser(user.userId, user.username, giftCode);
                yield message.channel.send(redeemResult);
            }
            message.reply("✅ Finished redeeming codes");
            break;
        case "!add":
            if (args.length != 3) {
                return message.reply("⚠️ Usage: `!add <userId> <username> (no spaces in username)`");
            }
            if (isNaN(parseInt(args[1]))) {
                return message.reply("⚠️ Usage: `!add <userId> <username> (no spaces in username)`");
            }
            const addResult = yield addUserToSheet(guildId, args[1], args[2]);
            message.reply(addResult);
            break;
        case "!delete":
            if (args.length != 2) {
                return message.reply("⚠️ Usage: `!delete <userId>`");
            }
            const deleteResult = yield deleteUserFromSheet(guildId, args[1]);
            message.reply(deleteResult);
            break;
        default:
            break;
    }
}));
discordClient.once("ready", () => __awaiter(void 0, void 0, void 0, function* () {
    var _a;
    console.log(`Logged in as ${(_a = discordClient.user) === null || _a === void 0 ? void 0 : _a.tag}!`);
    for (const guild of discordClient.guilds.cache.values()) {
        yield createGuildSheet(guild.id, guild.name);
    }
}));
/**
 * When the bot joins a new server, create a new Google Sheet tab for it.
 */
discordClient.on("guildCreate", (guild) => __awaiter(void 0, void 0, void 0, function* () {
    console.log(`📌 Joined new server: ${guild.name} (${guild.id})`);
    yield createGuildSheet(guild.id, guild.name);
}));
discordClient.login(DISCORD_BOT_TOKEN);
