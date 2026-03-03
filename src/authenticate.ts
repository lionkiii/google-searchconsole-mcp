#!/usr/bin/env node

import { google } from "googleapis";
import * as fs from "fs";
import * as http from "http";
import open from "open";
import {
  SCOPES,
  TOKENS_DIR,
  listAccounts,
  saveTokenForAccount,
  migrateLegacyToken,
  loadCredentials,
  AccountTokenInfo,
} from "./auth.js";

function parseArgs(): { alias: string; list: boolean } {
  const args = process.argv.slice(2);
  let alias = "default";
  let list = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--alias" && i + 1 < args.length) {
      alias = args[i + 1];
      i++;
    } else if (args[i] === "--list") {
      list = true;
    }
  }

  return { alias, list };
}

async function fetchEmail(
  oAuth2Client: InstanceType<typeof google.auth.OAuth2>
): Promise<string | undefined> {
  try {
    const oauth2 = google.oauth2({ version: "v2", auth: oAuth2Client });
    const { data } = await oauth2.userinfo.get();
    return data.email || undefined;
  } catch {
    return undefined;
  }
}

async function authenticate() {
  // Ensure migration happens first
  migrateLegacyToken();

  const { alias, list } = parseArgs();

  if (list) {
    const accounts = listAccounts();
    if (accounts.length === 0) {
      console.log("No accounts found. Run `gsc-mcp-auth` to authenticate.");
    } else {
      console.log("Authenticated accounts:");
      for (const a of accounts) {
        console.log(`  - ${a.alias}${a.email ? ` (${a.email})` : ""}`);
      }
    }
    process.exit(0);
  }

  console.log(`Starting Google Search Console authentication for account: "${alias}"...\n`);

  // Ensure tokens directory exists
  if (!fs.existsSync(TOKENS_DIR)) {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
  }

  const tokenPath = `${TOKENS_DIR}/${alias}.json`;

  // Check if already authenticated for this alias
  if (fs.existsSync(tokenPath)) {
    console.log(`Existing tokens found for "${alias}" at: ${tokenPath}`);
    console.log("Delete this file if you want to re-authenticate.\n");

    // Verify tokens still work
    try {
      const credentials = loadCredentials(alias);
      const { client_id, client_secret } = credentials.installed;
      const oAuth2Client = new google.auth.OAuth2(
        client_id,
        client_secret,
        "http://localhost:3000/oauth2callback"
      );

      const fileData: AccountTokenInfo = JSON.parse(
        fs.readFileSync(tokenPath, "utf-8")
      );
      oAuth2Client.setCredentials(fileData.tokens);

      // Test the connection
      const searchConsole = google.searchconsole({ version: "v1", auth: oAuth2Client });
      await searchConsole.sites.list();

      console.log(`Authentication is valid for "${alias}"! You can use the MCP server.`);
      process.exit(0);
    } catch (error) {
      console.log("Existing tokens are invalid. Re-authenticating...\n");
      fs.unlinkSync(tokenPath);
    }
  }

  const credentials = loadCredentials(alias);
  const { client_id, client_secret } = credentials.installed;
  const oAuth2Client = new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/oauth2callback"
  );

  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  console.log("Opening browser for authentication...");
  console.log("If browser doesn't open, visit this URL:\n");
  console.log(authUrl + "\n");

  const server = http.createServer(async (req, res) => {
    try {
      if (req.url?.startsWith("/oauth2callback")) {
        const url = new URL(req.url, "http://localhost:3000");
        const code = url.searchParams.get("code");

        if (code) {
          console.log("Received authorization code, exchanging for tokens...");

          const { tokens } = await oAuth2Client.getToken(code);
          oAuth2Client.setCredentials(tokens);

          // Fetch email for the account
          const email = await fetchEmail(oAuth2Client);

          // Save tokens with email
          saveTokenForAccount(alias, tokens as any, email);
          console.log(`\nTokens saved for "${alias}" at: ${tokenPath}`);
          if (email) {
            console.log(`Account email: ${email}`);
          }

          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`
            <html>
              <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; background: #1a1a1a; color: white;">
                <div style="text-align: center;">
                  <h1>Authentication Successful!</h1>
                  <p>Account "${alias}"${email ? ` (${email})` : ""} is now authenticated.</p>
                  <p>You can close this window and use the GSC MCP server in Claude Desktop.</p>
                </div>
              </body>
            </html>
          `);

          console.log(`\nAuthentication successful for "${alias}"! You can now use the MCP server in Claude Desktop.`);

          setTimeout(() => {
            server.close();
            process.exit(0);
          }, 1000);
        } else {
          res.writeHead(400, { "Content-Type": "text/plain" });
          res.end("No authorization code received");
        }
      }
    } catch (error) {
      console.error("Error:", error);
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Authentication error");
      server.close();
      process.exit(1);
    }
  });

  server.listen(3000, async () => {
    console.log("Waiting for authentication callback on http://localhost:3000 ...\n");
    await open(authUrl);
  });
}

authenticate().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
