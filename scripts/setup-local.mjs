import { existsSync, readFileSync, writeFileSync, chmodSync } from "node:fs";
import { parseEnv } from "node:util";
import { randomBytes } from "node:crypto";

if (!existsSync(".dev.vars")) {
  const template = readFileSync(".env.example", "utf8")
    .replace(
      "BETTER_AUTH_SECRET=",
      "BETTER_AUTH_SECRET=" + randomBytes(48).toString("base64url"),
    )
    .replace(
      "REDEMPTION_ENCRYPTION_KEY=",
      "REDEMPTION_ENCRYPTION_KEY=" + randomBytes(32).toString("hex"),
    );
  writeFileSync(".dev.vars", template, { mode: 0o600 });
  chmodSync(".dev.vars", 0o600);
  console.log(
    "Created private local configuration (.dev.vars). Secret values were not printed.",
  );
} else {
  const current = readFileSync(".dev.vars", "utf8");
  if (!parseEnv(current).REDEMPTION_ENCRYPTION_KEY?.trim()) {
    const clean = current.replace(/^REDEMPTION_ENCRYPTION_KEY=.*$/gm, "");
    writeFileSync(
      ".dev.vars",
      clean +
        "\nREDEMPTION_ENCRYPTION_KEY=" +
        randomBytes(32).toString("hex") +
        "\n",
      { mode: 0o600 },
    );
    chmodSync(".dev.vars", 0o600);
    console.log(
      "Added private local redemption key. Existing settings preserved.",
    );
  } else console.log("Existing local configuration preserved.");
}
