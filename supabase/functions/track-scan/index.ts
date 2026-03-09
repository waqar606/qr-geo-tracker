import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function getOS(ua: string): string {
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/macintosh|mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "Other";
}

function getClientIP(req: Request): string {
  // Try standard proxy headers for the real client IP
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const realIp = req.headers.get("x-real-ip");
  if (realIp) return realIp.trim();
  return "";
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { qr_code_id } = await req.json();
    if (!qr_code_id) {
      return new Response(JSON.stringify({ error: "qr_code_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userAgent = req.headers.get("user-agent") || "";
    const os = getOS(userAgent);
    const clientIP = getClientIP(req);

    let country = "Unknown";
    let city = "Unknown";
    let region = "Unknown";

    // Use external Geo backend (MMDB) for geo lookup
    try {
      const geoBaseUrl =
        Deno.env.get("GEO_BACKEND_URL") || "http://localhost:4000/geo";
      const url = new URL(geoBaseUrl);
      if (clientIP) {
        url.searchParams.set("ip", clientIP);
      }

      const geoRes = await fetch(url.toString(), {
        headers: { "User-Agent": "qr-geo-tracker/1.0" },
      });

      if (geoRes.ok) {
        const geo = await geoRes.json();
        if (!geo.error) {
          country = geo.country || "Unknown";
          city = geo.city || "Unknown";
          region = geo.region || "Unknown";
        }
      }
    } catch {
      // geo lookup failed, use defaults
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch QR code first (and enforce paused/not found server-side)
    const { data: qr, error: qrErr } = await supabase
      .from("qr_codes")
      .select("id, name, type, content, style, paused, file_url, file_urls, user_id")
      .eq("id", qr_code_id)
      .maybeSingle();

    if (qrErr || !qr || qr.paused) {
      return new Response(JSON.stringify({ error: "not_found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
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

    return new Response(
      JSON.stringify({
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
      }),
      {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
