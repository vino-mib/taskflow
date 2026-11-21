import http from "http";
import type { AddressInfo } from "net";
import { randomBytes } from "crypto";
import { spawn } from "child_process";
import { gql, GraphQLFailure } from "./graphql.js";
import type { Session } from "./session.js";

const LOGIN = `mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    token
    refreshToken
    user { email }
  }
}`;

interface LoginResult {
  login: { token: string; refreshToken: string; user: { email: string } };
}

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function loginPage(action: string, error = ""): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in to TaskFlow</title>
<style>
  body { font-family: system-ui, sans-serif; background: #faf7f2; color: #2b2b2b; margin: 0; min-height: 100vh; display: grid; place-items: center; }
  form { background: #fff; padding: 32px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,.08); width: min(360px, 90vw); display: grid; gap: 12px; }
  h1 { font-size: 20px; margin: 0; }
  input { padding: 10px; border: 1px solid #ddd; border-radius: 8px; font: inherit; }
  button { padding: 10px; border: 0; border-radius: 8px; background: #1f2937; color: #fff; font: inherit; cursor: pointer; }
  .error { color: #b91c1c; font-size: 14px; margin: 0; }
</style>
</head>
<body>
<form method="post" action="${action}">
  <h1>Sign in to TaskFlow</h1>
  ${error ? `<p class="error">${escapeHtml(error)}</p>` : ""}
  <input name="email" type="email" placeholder="Email" required autofocus>
  <input name="password" type="password" placeholder="Password" required>
  <button type="submit">Sign in</button>
</form>
</body>
</html>`;
}

function donePage(email: string): string {
  return `<!doctype html>
<html lang="en">
<head><meta charset="utf-8"><title>TaskFlow connected</title></head>
<body style="font-family: system-ui, sans-serif; padding: 40px;">
  <h1>Connected as ${escapeHtml(email)}</h1>
  <p>You can close this tab and return to Claude.</p>
</body>
</html>`;
}

function send(res: http.ServerResponse, status: number, html: string) {
  res.writeHead(status, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
  res.end(html);
}

function readBody(req: http.IncomingMessage, limit = 10_000): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on("data", (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) {
        reject(new Error("Request body too large"));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

// Best effort: if the browser does not open, the URL is printed to stderr.
function openBrowser(url: string) {
  const [cmd, args] =
    process.platform === "win32"
      ? ["cmd", ["/c", "start", "", url]]
      : process.platform === "darwin"
        ? ["open", [url]]
        : ["xdg-open", [url]];
  try {
    spawn(cmd, args, { detached: true, stdio: "ignore" }).on("error", () => {}).unref();
  } catch {
    // ignore; the URL is printed to stderr
  }
}

// Serves a sign-in form on 127.0.0.1 at a one-time URL, then resolves with the
// session the TaskFlow API returns. The password goes only from this form to the API.
export function browserLogin(timeoutMs = 5 * 60_000): Promise<Session> {
  const nonce = randomBytes(16).toString("hex");
  const basePath = `/login/${nonce}`;

  return new Promise<Session>((resolve, reject) => {
    let settled = false;
    const finish = (action: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      server.close();
      action();
    };

    const server = http.createServer(async (req, res) => {
      if (!req.url?.startsWith(basePath)) {
        res.writeHead(404).end("Not found");
        return;
      }

      if (req.method === "GET") {
        send(res, 200, loginPage(basePath));
        return;
      }

      if (req.method === "POST") {
        try {
          const form = new URLSearchParams(await readBody(req));
          const data = await gql<LoginResult>(LOGIN, {
            email: form.get("email") ?? "",
            password: form.get("password") ?? "",
          });
          const session: Session = {
            email: data.login.user.email,
            token: data.login.token,
            refreshToken: data.login.refreshToken,
          };
          send(res, 200, donePage(session.email));
          finish(() => resolve(session));
        } catch (err) {
          const message = err instanceof GraphQLFailure || err instanceof Error ? err.message : "Sign-in failed";
          send(res, 200, loginPage(basePath, message));
        }
        return;
      }

      res.writeHead(405).end();
    });

    const timer = setTimeout(
      () => finish(() => reject(new Error("Sign-in timed out. Ask Claude to try again."))),
      timeoutMs,
    );

    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      const url = `http://127.0.0.1:${port}${basePath}`;
      console.error(`TaskFlow sign-in page: ${url}`);
      openBrowser(url);
    });
  });
}
