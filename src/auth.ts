import { google } from "googleapis";
import { OAuth2Client } from "google-auth-library";
import * as fs from "fs";
import * as path from "path";
import * as http from "http";
import open from "open";

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || "";
const CONFIG_DIR = path.join(HOME_DIR, ".gsc-mcp");
const LEGACY_TOKEN_PATH = path.join(HOME_DIR, ".gsc-mcp-tokens.json");
const LEGACY_TOKENS_DIR = path.join(HOME_DIR, ".gsc-mcp-tokens");
const TOKENS_DIR = path.join(CONFIG_DIR, "tokens");
const CREDENTIALS_PATH = path.join(CONFIG_DIR, "credentials.json");

const SCOPES = [
  "https://www.googleapis.com/auth/webmasters.readonly",
  "https://www.googleapis.com/auth/userinfo.email",
];

interface Credentials {
  installed: {
    client_id: string;
    client_secret: string;
    redirect_uris: string[];
  };
}

interface TokenInfo {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

export interface AccountTokenInfo {
  tokens: TokenInfo;
  email?: string;
}

export interface AccountInfo {
  alias: string;
  email?: string;
}

// Cache of authenticated clients keyed by alias
const clientCache = new Map<string, OAuth2Client>();

function ensureConfigDir(): void {
  if (!fs.existsSync(CONFIG_DIR)) {
    fs.mkdirSync(CONFIG_DIR, { recursive: true });
  }
}

function ensureTokensDir(): void {
  ensureConfigDir();
  if (!fs.existsSync(TOKENS_DIR)) {
    fs.mkdirSync(TOKENS_DIR, { recursive: true });
  }
}

/**
 * Migrate from legacy ~/.gsc-mcp-tokens/ directory to ~/.gsc-mcp/tokens/
 */
function migrateLegacyTokensDir(): void {
  if (fs.existsSync(LEGACY_TOKENS_DIR) && !fs.existsSync(TOKENS_DIR)) {
    ensureTokensDir();
    const files = fs.readdirSync(LEGACY_TOKENS_DIR);
    for (const file of files) {
      const src = path.join(LEGACY_TOKENS_DIR, file);
      const dest = path.join(TOKENS_DIR, file);
      if (!fs.existsSync(dest)) {
        fs.copyFileSync(src, dest);
      }
    }
    console.error(`Migrated tokens from ~/.gsc-mcp-tokens/ to ~/.gsc-mcp/tokens/`);
  }
}

function getTokenPath(alias: string): string {
  return path.join(TOKENS_DIR, `${alias}.json`);
}

/**
 * Migrate legacy single-token file to the new per-account directory.
 * Copies ~/.gsc-mcp-tokens.json → ~/.gsc-mcp-tokens/default.json
 * Legacy file is NOT deleted (safe migration).
 */
export function migrateLegacyToken(): void {
  migrateLegacyTokensDir();
  if (fs.existsSync(LEGACY_TOKEN_PATH) && !fs.existsSync(getTokenPath("default"))) {
    ensureTokensDir();
    const legacyContent = fs.readFileSync(LEGACY_TOKEN_PATH, "utf-8");
    const tokens = JSON.parse(legacyContent);
    const accountData: AccountTokenInfo = {
      tokens: tokens.tokens || tokens,
      email: tokens.email,
    };
    fs.writeFileSync(getTokenPath("default"), JSON.stringify(accountData, null, 2));
    console.error("Migrated legacy token to ~/.gsc-mcp/tokens/default.json");
  }
}

/**
 * List all saved accounts (aliases + emails).
 */
export function listAccounts(): AccountInfo[] {
  ensureTokensDir();
  migrateLegacyToken();

  const files = fs.readdirSync(TOKENS_DIR).filter(
    (f) => f.endsWith(".json") && !f.endsWith(".credentials.json")
  );
  return files.map((f) => {
    const alias = path.basename(f, ".json");
    try {
      const data: AccountTokenInfo = JSON.parse(
        fs.readFileSync(path.join(TOKENS_DIR, f), "utf-8")
      );
      return { alias, email: data.email };
    } catch {
      return { alias };
    }
  });
}

/**
 * Save tokens for a specific account alias.
 */
export function saveTokenForAccount(
  alias: string,
  tokens: TokenInfo,
  email?: string
): void {
  ensureTokensDir();
  const data: AccountTokenInfo = { tokens, email };
  fs.writeFileSync(getTokenPath(alias), JSON.stringify(data, null, 2));
}

// Default bundled OAuth2 credentials for the gsc-mcp-server app.
// Users authenticate with their own Google account — these just identify the app.
// Users can override with their own credentials via env vars or config file.
const DEFAULT_CLIENT_ID = "626206608100-ftn862187759dgdkiojaaslrfgecq9ss.apps.googleusercontent.com";
const DEFAULT_CLIENT_SECRET = "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";

/**
 * Load OAuth2 credentials. Resolution order:
 * 1. Environment variables: GSC_CLIENT_ID + GSC_CLIENT_SECRET
 * 2. Per-account credentials file: ~/.gsc-mcp/tokens/{alias}.credentials.json
 * 3. Config file: ~/.gsc-mcp/credentials.json
 * 4. Bundled default credentials (built into the package)
 */
export function loadCredentials(alias?: string): Credentials {
  // 1. Environment variables
  const envClientId = process.env.GSC_CLIENT_ID;
  const envClientSecret = process.env.GSC_CLIENT_SECRET;
  if (envClientId && envClientSecret) {
    return {
      installed: {
        client_id: envClientId,
        client_secret: envClientSecret,
        redirect_uris: ["http://localhost"],
      },
    };
  }

  // 2. Per-account credentials file
  if (alias) {
    const perAccountCreds = path.join(TOKENS_DIR, `${alias}.credentials.json`);
    if (fs.existsSync(perAccountCreds)) {
      return JSON.parse(fs.readFileSync(perAccountCreds, "utf-8"));
    }
  }

  // 3. Config file
  if (fs.existsSync(CREDENTIALS_PATH)) {
    return JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
  }

  // 4. Bundled default credentials
  return {
    installed: {
      client_id: DEFAULT_CLIENT_ID,
      client_secret: DEFAULT_CLIENT_SECRET,
      redirect_uris: ["http://localhost"],
    },
  };
}

function createOAuth2Client(credentials: Credentials): OAuth2Client {
  const { client_id, client_secret } = credentials.installed;
  return new google.auth.OAuth2(
    client_id,
    client_secret,
    "http://localhost:3000/oauth2callback"
  );
}

/**
 * Get an authenticated OAuth2 client for a specific account.
 * - If alias is provided, loads that account.
 * - If alias is omitted and only one account exists, uses it.
 * - If alias is omitted and multiple accounts exist, throws an error.
 */
export async function getAuthenticatedClient(
  alias?: string
): Promise<OAuth2Client> {
  ensureTokensDir();
  migrateLegacyToken();

  // Resolve alias
  let resolvedAlias: string;
  if (alias) {
    resolvedAlias = alias;
  } else {
    const accounts = listAccounts();
    if (accounts.length === 0) {
      throw new Error(
        "No accounts found. Run `gsc-mcp-auth` to authenticate."
      );
    } else if (accounts.length === 1) {
      resolvedAlias = accounts[0].alias;
    } else {
      const accountList = accounts
        .map((a) => `  - ${a.alias}${a.email ? ` (${a.email})` : ""}`)
        .join("\n");
      throw new Error(
        `Multiple accounts found. Specify an account:\n${accountList}\n\nPass the "account" parameter to select one.`
      );
    }
  }

  // Check cache
  if (clientCache.has(resolvedAlias)) {
    return clientCache.get(resolvedAlias)!;
  }

  const tokenPath = getTokenPath(resolvedAlias);
  if (!fs.existsSync(tokenPath)) {
    throw new Error(
      `Account "${resolvedAlias}" not found. Run: gsc-mcp-auth --alias ${resolvedAlias}`
    );
  }

  const credentials = loadCredentials(resolvedAlias);
  const oAuth2Client = createOAuth2Client(credentials);

  const fileData: AccountTokenInfo = JSON.parse(
    fs.readFileSync(tokenPath, "utf-8")
  );
  const tokens = fileData.tokens;
  oAuth2Client.setCredentials(tokens);

  // Check if token is expired
  if (tokens.expiry_date && tokens.expiry_date < Date.now()) {
    try {
      const { credentials: newTokens } =
        await oAuth2Client.refreshAccessToken();
      oAuth2Client.setCredentials(newTokens);
      saveTokenForAccount(
        resolvedAlias,
        newTokens as TokenInfo,
        fileData.email
      );
    } catch {
      clientCache.delete(resolvedAlias);
      throw new Error(
        `Token refresh failed for "${resolvedAlias}". Re-authenticate: gsc-mcp-auth --alias ${resolvedAlias}`
      );
    }
  }

  clientCache.set(resolvedAlias, oAuth2Client);
  return oAuth2Client;
}

async function getNewToken(oAuth2Client: OAuth2Client): Promise<OAuth2Client> {
  const authUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES,
    prompt: "consent",
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      try {
        if (req.url?.startsWith("/oauth2callback")) {
          const url = new URL(req.url, "http://localhost:3000");
          const code = url.searchParams.get("code");

          if (code) {
            const { tokens } = await oAuth2Client.getToken(code);
            oAuth2Client.setCredentials(tokens);

            // Save tokens (used by authenticate.ts flow, default alias)
            saveTokenForAccount("default", tokens as TokenInfo);

            res.writeHead(200, { "Content-Type": "text/html" });
            res.end(`
              <html>
                <body style="font-family: system-ui; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0;">
                  <div style="text-align: center;">
                    <h1>Authentication Successful!</h1>
                    <p>You can close this window and return to Claude.</p>
                  </div>
                </body>
              </html>
            `);

            server.close();
            resolve(oAuth2Client);
          } else {
            res.writeHead(400, { "Content-Type": "text/plain" });
            res.end("No authorization code received");
            server.close();
            reject(new Error("No authorization code received"));
          }
        }
      } catch (error) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end("Authentication error");
        server.close();
        reject(error);
      }
    });

    server.listen(3000, async () => {
      console.error("Opening browser for authentication...");
      await open(authUrl);
    });

    // Timeout after 5 minutes
    setTimeout(() => {
      server.close();
      reject(new Error("Authentication timeout"));
    }, 5 * 60 * 1000);
  });
}

// Re-export for external use
export { SCOPES, CREDENTIALS_PATH, CONFIG_DIR, TOKENS_DIR, LEGACY_TOKEN_PATH };
