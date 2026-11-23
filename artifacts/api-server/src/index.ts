import app from "./app";
import { logger } from "./lib/logger";

const rawPort = process.env["PORT"] || "8080";
const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

if (!process.env["TENNIS_SHEETS_WRITE_ENABLED"]) {
  process.env["TENNIS_SHEETS_WRITE_ENABLED"] = "false";
}

app.listen(port, "0.0.0.0", (err) => {
  if (err) {
    logger.error({ err }, "Error listening on port");
    process.exit(1);
  }

  logger.info(
    {
      port,
      host: "0.0.0.0",
      nodeEnv: process.env["NODE_ENV"] || "development",
      sheetsWriteEnabled: process.env["TENNIS_SHEETS_WRITE_ENABLED"],
    },
    "TENNIS-FUSION-SIGNAL server listening (API + 2-Box Dashboard)",
  );
});
