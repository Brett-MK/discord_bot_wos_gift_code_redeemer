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

async function getUsersFromSheet(guildId: string): Promise<User[]> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Guild_${guildId}!A:B`,
    });

    const rows = response.data.values || [];
    return rows.slice(1).map(([userId, username]) => ({ userId, username }));
  } catch (error) {
    console.error("Error fetching users:", error);
    return [];
  }
}

async function addUserToSheet(
  guildId: string,
  userId: string,
  username: string
): Promise<string> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `Guild_${guildId}!A:A`, // Get only the column with User IDs (column A)
    });

    const rows = response.data.values;
    if (rows && rows.some((row) => row[0] === userId)) {
      return `❌ User ID **${userId}** already exists in the sheet.`;
    }

    await sheets.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `Guild_${guildId}!A:B`,
      valueInputOption: "RAW",
      requestBody: { values: [[userId, username]] },
    });
    return `✅ User ID **${userId}** (Name: **${username}**) has been added!`;
  } catch (error) {
    console.error("Error adding user:", error);
    return `❌ Failed to add User ID **${userId}**.`;
  }
}

async function deleteUserFromSheet(
  guildId: string,
  userId: string
): Promise<string> {
  try {
    const sheetMetadataResponse = await sheets.spreadsheets.get({
      spreadsheetId: SHEET_ID,
    });

    const sheet = sheetMetadataResponse.data.sheets?.find(
      (sheet) => sheet.properties?.title === `Guild_${guildId}`
    );

    if (!sheet || !sheet.properties?.sheetId) {
      return `❌ Sheet for guild **${guildId}** not found.`;
    }

    const sheetId = sheet.properties.sheetId;

    const response = await sheets.spreadsheets.values.get({
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
    await sheets.spreadsheets.batchUpdate({
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
  } catch (error) {
    console.error("Error deleting user:", error);
    return `❌ Failed to delete User ID **${userId}**.`;
  }
}

export async function createGuildSheet(guildId: string, guildName: string) {
  const sheetTitle = `Guild_${guildId}`;

  const spreadsheet = await sheets.spreadsheets.get({
    spreadsheetId: SHEET_ID,
  });

  const sheetExists = spreadsheet.data.sheets?.some(
    (sheet) => sheet.properties?.title === sheetTitle
  );

  if (!sheetExists) {
    await sheets.spreadsheets.batchUpdate({
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
    await sheets.spreadsheets.values.update({
      spreadsheetId: SHEET_ID,
      range: `${sheetTitle}!A1:B1`,
      valueInputOption: "RAW",
      requestBody: { values: [["UserID", "Username"]] },
    });

    console.log(`✅ Created new sheet for ${guildName} (${guildId})`);
  }
}

export { getUsersFromSheet, deleteUserFromSheet, addUserToSheet };
