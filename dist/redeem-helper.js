var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function redeemForUser(userId, username, giftCode, browser) {
    return __awaiter(this, void 0, void 0, function* () {
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
            return `✅ ${username}:${userId} - ${message}`;
        }
        catch (error) {
            console.error(`Error redeeming code for user ${username}:${userId}:`, error);
            return `❌ ${username}:${userId} - Failed to redeem code ${giftCode}, ${error}`;
        }
        finally {
            yield page.close();
        }
    });
}
export { redeemForUser };
