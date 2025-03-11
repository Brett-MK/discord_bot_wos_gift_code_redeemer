import { google } from "googleapis";
import { config } from "dotenv";
import { User } from "./user.interface";

config();

const SHEET_ID = process.env.SHEET_ID!;
const GOOGLE_CLIENT_EMAIL = process.env.GOOGLE_CLIENT_EMAIL!;
const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!.replace(
  /\\n/g,
  "\n"
);

const auth = new google.auth.JWT({
  email: GOOGLE_CLIENT_EMAIL,
  key: GOOGLE_PRIVATE_KEY,
  scopes: ["https://www.googleapis.com/auth/spreadsheets"],
});

const sheets = google.sheets({ version: "v4", auth });

async function getUsersFromSheet(): Promise<User[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Alliance_100!A:B",
    });

    const rows = response.data.values || [];
    return rows.slice(1).map(([userId, username]) => ({ userId, username }));
  } catch (error) {
    console.error("Error fetching Google Sheet:", error);
    return [];
  }
}

async function addUserToSheet(
  userId: string,
  username: string
): Promise<string> {
  try {
    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: "Alliance_100!A:B",
      valueInputOption: "RAW",
      requestBody: { values: [[userId, username]] },
    });
    return `✅ User ID **${userId}** (Name: **${username}**) has been added!`;
  } catch (error) {
    console.error("Error adding user to Google Sheet:", error);
    return `❌ Failed to add User ID **${userId}**.`;
  }
}

async function deleteUserFromSheet(userId: string): Promise<string> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: "Alliance_100!A:B",
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
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId: SHEET_ID,
      requestBody: {
        requests: [
          {
            deleteDimension: {
              range: {
                sheetId: 0,
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
  } catch (error) {
    console.error("Error deleting user from Google Sheet:", error);
    return `❌ Failed to delete User ID **${userId}**.`;
  }
}

export { getUsersFromSheet, deleteUserFromSheet, addUserToSheet };
