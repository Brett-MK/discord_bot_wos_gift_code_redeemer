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
import { addUserToSheet, createGuildSheet, deleteUserFromSheet, getUsersFromSheet, } from "./google-sheets.js";
import { redeemForUser } from "./redeem-helper.js";
import { ADD_HELP_MESSAGE, DELETE_HELP_MESSAGE, HELP_MESSAGE, LIST_HELP_MESSAGE, REDEEM_HELP_MESSAGE, } from "./help-messages.const.js";
config();
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const discordClient = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});
function handleRedeemMessage(message, guildId, giftCode) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield getUsersFromSheet(guildId);
        if (users.length === 0) {
            return "❌ No users found!";
        }
        for (const user of users) {
            let attempts = 0;
            const maxRetries = 5;
            let delay = 1000; // Start with 1 second delay
            while (attempts < maxRetries) {
                const result = yield redeemForUser(user.userId, user.username, giftCode);
                if (result.includes("Gift Code not found, this is case-sensitive!") ||
                    result.includes("Expired, unable to claim.")) {
                    return "❌ Gift code is expired or not found";
                }
                else if (result.includes("Server busy. Please try again later.") ||
                    result.includes("Check UserID, timed out logging in.")) {
                    attempts++;
                    if (attempts < maxRetries) {
                        yield new Promise((resolve) => setTimeout(resolve, delay));
                        delay *= 2; // Exponential backoff
                        continue;
                    }
                    else {
                        yield message.channel.send(`❌ Failed to redeem for ${user.username}:${user.userId} after multiple attempts. Check the user ID.`);
                    }
                }
                else {
                    yield message.channel.send(result);
                    break; // Successful redemption, move to next user
                }
            }
        }
        return "✅ Finished redeeming codes";
    });
}
function handleListUsers(message, guildId) {
    return __awaiter(this, void 0, void 0, function* () {
        const users = yield getUsersFromSheet(guildId);
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
            yield message.channel.send(chunk);
            chunkStart = chunkEnd; // Move the start of the next chunk
        }
    });
}
discordClient.on("messageCreate", (message) => __awaiter(void 0, void 0, void 0, function* () {
    if (!message.guild || message.author.bot)
        return; // Ignore bot messages
    const guildId = message.guild.id;
    const args = message.content.split(" ");
    switch (args[0]) {
        case "!redeem": {
            if (args.length != 2) {
                return message.reply(REDEEM_HELP_MESSAGE);
            }
            const giftCode = args[1];
            message.reply(`🔄 Redeeming code **${giftCode}** for all users...`);
            const result = yield handleRedeemMessage(message, guildId, giftCode);
            message.reply(result);
            break;
        }
        case "!add": {
            if (args.length != 3 || isNaN(parseInt(args[1]))) {
                return message.reply(ADD_HELP_MESSAGE);
            }
            const result = yield addUserToSheet(guildId, args[1], args[2]);
            message.reply(result);
            break;
        }
        case "!delete": {
            if (args.length != 2) {
                return message.reply(DELETE_HELP_MESSAGE);
            }
            const result = yield deleteUserFromSheet(guildId, args[1]);
            message.reply(result);
            break;
        }
        case "!list": {
            if (args.length != 1) {
                return message.reply(LIST_HELP_MESSAGE);
            }
            yield handleListUsers(message, guildId);
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
