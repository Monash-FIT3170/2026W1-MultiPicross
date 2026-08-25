import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createServiceAccount } from "../auth/service-account.js";
import { pgClient } from "../db/client.js";

class Cancelled extends Error {}

// Reads stdin directly with no readline attached: readline echoes every
// keystroke it receives regardless of the terminal's own echo flag.
function readHiddenLine(prompt: string): Promise<string> {
  // Raw mode first: anything typed between printing the prompt and disabling
  // echo would be echoed by the terminal driver.
  const wasRaw = stdin.isRaw;
  stdin.setRawMode(true);
  stdin.resume();
  stdout.write(prompt);

  return new Promise((resolve, reject) => {
    const bytes: number[] = [];

    const restore = () => {
      stdin.off("data", onData);
      process.off("SIGINT", onSignal);
      process.off("SIGTERM", onSignal);
      stdin.setRawMode(wasRaw);
      stdin.pause();
    };

    const onSignal = () => {
      restore();
      stdout.write("\n");
      reject(new Cancelled());
    };

    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 13 || byte === 10) {
          restore();
          stdout.write("\n");
          resolve(Buffer.from(bytes).toString("utf8"));
          return;
        }
        if (byte === 3) {
          onSignal();
          return;
        }
        if (byte === 127 || byte === 8) {
          while (bytes.length && (bytes[bytes.length - 1] & 0xc0) === 0x80) {
            bytes.pop();
          }
          bytes.pop();
          continue;
        }
        bytes.push(byte);
      }
    };

    stdin.on("data", onData);
    process.once("SIGINT", onSignal);
    process.once("SIGTERM", onSignal);
  });
}

async function readPassword(prompt: string): Promise<string> {
  if (stdin.isTTY) return readHiddenLine(prompt);
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    return await rl.question(prompt);
  } finally {
    rl.close();
  }
}

async function main(): Promise<void> {
  const rl = createInterface({ input: stdin, output: stdout });
  let username: string;
  try {
    username = (await rl.question("Username: ")).trim();
  } finally {
    rl.close();
  }

  const password = await readPassword("Password: ");

  if (!username || password.length < 8) {
    console.error(
      "Username must be non-empty and password at least 8 characters.",
    );
    process.exitCode = 1;
    return;
  }

  // Nothing echoes the password and createServiceAccount will not reset it later,
  // so an unnoticed typo produces an account nobody can sign in to.
  if ((await readPassword("Confirm password: ")) !== password) {
    console.error("Passwords do not match.");
    process.exitCode = 1;
    return;
  }

  const result = await createServiceAccount(username, password);
  if (!result.created) {
    console.error(`An account with username "${username}" already exists.`);
    process.exitCode = 1;
    return;
  }
  console.log(`Service account "${username}" created.`);
}

try {
  await main();
} catch (err) {
  if (err instanceof Cancelled) {
    process.exitCode = 130;
  } else {
    throw err;
  }
} finally {
  // postgres-js keeps idle connections open, which would otherwise hang this one-shot script's exit.
  await pgClient.end({ timeout: 1 });
}
