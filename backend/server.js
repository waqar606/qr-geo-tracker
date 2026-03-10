import "dotenv/config";
import express from "express";
import cors from "cors";
import maxmind from "maxmind";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

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

function getOS(ua) {
  if (!ua) return "Other";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function getClientIP(req) {
  const forwarded = req.headers["x-forwarded-for"];
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers["x-real-ip"];
  if (realIp) return realIp.trim();
  return "";
}

function getGeoFromMMDB(ip) {
  if (!cityLookup || !ip) return { country: "Unknown", city: "Unknown", region: "Unknown" };
  try {
    const geo = cityLookup.get(ip);
    if (!geo) return { country: "Unknown", city: "Unknown", region: "Unknown" };
    const country = (geo.country?.names?.en) || "Unknown";
    const city = (geo.city?.names?.en) || "Unknown";
    const region = (geo.subdivisions?.[0]?.names?.en) || "Unknown";
    return { country, city, region };
  } catch {
    return { country: "Unknown", city: "Unknown", region: "Unknown" };
  }
}

app.post("/track-scan", async (req, res) => {
  try {
    const { qr_code_id } = req.body || {};
    if (!qr_code_id) {
      return res.status(400).json({ error: "qr_code_id required" });
    }

    const userAgent = req.headers["user-agent"] || "";
    const os = getOS(userAgent);
    const clientIP = getClientIP(req);
    const { country, city, region } = getGeoFromMMDB(clientIP);

    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return res.status(500).json({ error: "Server misconfigured: missing Supabase credentials" });
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data: qr, error: qrErr } = await supabase
      .from("qr_codes")
      .select("id, name, type, content, style, paused, file_url, file_urls, user_id")
      .eq("id", qr_code_id)
      .maybeSingle();

    if (qrErr || !qr || qr.paused) {
      return res.status(404).json({ error: "not_found" });
    }

    const { error } = await supabase.from("qr_scans").insert({
      qr_code_id,
      owner_id: qr.user_id ?? null,
      operating_system: os,
      country,
      city,
      region,
      user_agent: userAgent,
      ip_address: clientIP || null,
    });

    if (error) throw error;

    return res.json({
      success: true,
      qr_code: {
        id: qr.id,
        name: qr.name,
        type: qr.type,
        content: qr.content,
        style: qr.style,
        paused: qr.paused,
        file_url: qr.file_url,
        file_urls: qr.file_urls,
      },
    });
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error("track-scan error:", e);
    return res.status(500).json({ error: e.message || "Internal error" });
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

