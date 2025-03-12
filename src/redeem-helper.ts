import { chromium, Page } from "playwright";

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

    try {
      // Ensure login button disappears after login
      await page.waitForSelector(".login_btn", {
        state: "hidden",
        timeout: 5000,
      });
    } catch (error) {
      return `❌ ${username}:${userId} - check UserID, timed out logging in.`;
    }

    // Fill in the gift code
    await page.fill('input[placeholder="Enter Gift Code"]', giftCode);

    // Click the redeem button
    await page.locator(".exchange_btn").click();

    // Get the message
    const message = await page.locator(".msg").textContent();

    await browser.close();
    return `✅ ${username}:${userId} - ${message}`;
  } catch (error) {
    await browser.close();
    console.error(
      `Error redeeming code for user ${username}:${userId}:`,
      error
    );
    return `❌ ${username}:${userId} - Failed to redeem code ${giftCode}, ${error}`;
  }
}

export { redeemForUser };
