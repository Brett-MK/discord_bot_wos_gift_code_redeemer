var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { google } from "googleapis";
import { config } from "dotenv";
config();
const SHEET_ID = process.env.SHEET_ID;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, "\n");
const auth = new google.auth.JWT({
    email: GOOGLE_CLIENT_EMAIL,
    key: GOOGLE_PRIVATE_KEY,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});
const sheets = google.sheets({ version: "v4", auth });
function getUsersFromSheet(guildId) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const response = yield sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: `Guild_${guildId}!A:B`,
            });
            const rows = response.data.values || [];
            return rows.slice(1).map(([userId, username]) => ({ userId, username }));
        }
        catch (error) {
            console.error("Error fetching Google Sheet:", error);
            return [];
        }
    });
}
function addUserToSheet(guildId, userId, username) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            yield sheets.spreadsheets.values.append({
                spreadsheetId: SHEET_ID,
                range: `Guild_${guildId}!A:B`,
                valueInputOption: "RAW",
                requestBody: { values: [[userId, username]] },
            });
            return `✅ User ID **${userId}** (Name: **${username}**) has been added!`;
        }
        catch (error) {
            console.error("Error adding user to Google Sheet:", error);
            return `❌ Failed to add User ID **${userId}**.`;
        }
    });
}
function deleteUserFromSheet(guildId, userId) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const sheetMetadataResponse = yield sheets.spreadsheets.get({
                spreadsheetId: SHEET_ID,
            });
            const sheet = (_a = sheetMetadataResponse.data.sheets) === null || _a === void 0 ? void 0 : _a.find((sheet) => { var _a; return ((_a = sheet.properties) === null || _a === void 0 ? void 0 : _a.title) === `Guild_${guildId}`; });
            if (!sheet || !((_b = sheet.properties) === null || _b === void 0 ? void 0 : _b.sheetId)) {
                return `❌ Sheet for guild **${guildId}** not found.`;
            }
            const sheetId = sheet.properties.sheetId;
            const response = yield sheets.spreadsheets.values.get({
                spreadsheetId: SHEET_ID,
                range: `Guild_${guildId}!A:B`,
            });
            const rows = response.data.values;
            if (!rows || rows.length === 0) {
                return "❌ No data found in the sheet.";
            }
            // Find the row index of the user to delete (ignoring header row)
            const userIndex = rows.findIndex((row) => row[0] === userId);
            if (userIndex === -1) {
                return `❌ User ID **${userId}** not found.`;
            }
            // Delete row using batchUpdate (deletes row and shifts others up)
            yield sheets.spreadsheets.batchUpdate({
                spreadsheetId: SHEET_ID,
                requestBody: {
                    requests: [
                        {
                            deleteDimension: {
                                range: {
                                    sheetId: sheetId,
                                    dimension: "ROWS",
                                    startIndex: userIndex, // Zero-based index
                                    endIndex: userIndex + 1,
                                },
                            },
                        },
                    ],
                },
            });
            return `✅ User ID **${userId}** has been deleted.`;
        }
        catch (error) {
            console.error("Error deleting user from Google Sheet:", error);
            return `❌ Failed to delete User ID **${userId}**.`;
        }
    });
}
export function createGuildSheet(guildId, guildName) {
    return __awaiter(this, void 0, void 0, function* () {
        var _a;
        const sheetTitle = `Guild_${guildId}`;
        const spreadsheet = yield sheets.spreadsheets.get({
            spreadsheetId: SHEET_ID,
        });
        const sheetExists = (_a = spreadsheet.data.sheets) === null || _a === void 0 ? void 0 : _a.some((sheet) => { var _a; return ((_a = sheet.properties) === null || _a === void 0 ? void 0 : _a.title) === sheetTitle; });
        if (!sheetExists) {
            yield sheets.spreadsheets.batchUpdate({
                spreadsheetId: SHEET_ID,
                requestBody: {
                    requests: [
                        {
                            addSheet: {
                                properties: { title: sheetTitle },
                            },
                        },
                    ],
                },
            });
            // Initialize with headers
            yield sheets.spreadsheets.values.update({
                spreadsheetId: SHEET_ID,
                range: `${sheetTitle}!A1:B1`,
                valueInputOption: "RAW",
                requestBody: { values: [["UserID", "Username"]] },
            });
            console.log(`✅ Created new sheet for ${guildName} (${guildId})`);
        }
    });
}
export { getUsersFromSheet, deleteUserFromSheet, addUserToSheet };
