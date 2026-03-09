import express from "express";
import cors from "cors";
import maxmind from "maxmind";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());

const PORT = process.env.PORT || 4000;
const DB_PATH =
  process.env.GEOIP_DB_PATH ||
  path.join(__dirname, "data", "GeoLite-City.mmdb");

let cityLookup;

async function initGeoDb() {
  cityLookup = await maxmind.open(DB_PATH);
  // eslint-disable-next-line no-console
  console.log(`GeoIP database loaded from ${DB_PATH}`);
}

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.get("/geo", (req, res) => {
  if (!cityLookup) {
    return res.status(503).json({ error: "geo_db_not_ready" });
  }

  const queryIp = typeof req.query.ip === "string" ? req.query.ip : "";
  const forwarded = req.headers["x-forwarded-for"];
  const headerIp =
    typeof forwarded === "string"
      ? forwarded.split(",")[0].trim()
      : undefined;

  const ip = queryIp || headerIp || req.ip;

  if (!ip) {
    return res.status(400).json({ error: "ip_required" });
  }

  try {
    const geo = cityLookup.get(ip);

    if (!geo) {
      return res.json({
        country: "Unknown",
        city: "Unknown",
        region: "Unknown",
      });
    }

    const country =
      (geo.country && geo.country.names && geo.country.names.en) || "Unknown";
    const city =
      (geo.city && geo.city.names && geo.city.names.en) || "Unknown";
    const region =
      (geo.subdivisions &&
        geo.subdivisions[0] &&
        geo.subdivisions[0].names &&
        geo.subdivisions[0].names.en) ||
      "Unknown";

    return res.json({ country, city, region });
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error("Geo lookup failed:", error);
    return res.status(500).json({ error: "geo_lookup_failed" });
  }
});

initGeoDb()
  .then(() => {
    app.listen(PORT, () => {
      // eslint-disable-next-line no-console
      console.log(`Geo backend listening on port ${PORT}`);
    });
  })
  .catch((error) => {
    // eslint-disable-next-line no-console
    console.error("Failed to initialize GeoIP database:", error);
    process.exit(1);
  });

