export default {
  async fetch(request) {
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "*",
      "Access-Control-Max-Age": "86400",
    };

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders });
    }

    if (request.method !== "GET") {
      return new Response(
        JSON.stringify(
          {
            error: "Method Not Allowed",
            message: "Only GET requests are allowed",
          },
          null,
          2
        ),
        {
          status: 405,
          headers: {
            "Content-Type": "application/json",
            Allow: "GET, OPTIONS",
            ...corsHeaders,
          },
        }
      );
    }

    const cf = request.cf ?? {};

    const cfConnectingIP = request.headers.get("CF-Connecting-IP");
    const cfConnectingIPv4 = request.headers.get("CF-Connecting-IPv4");

    const isIPv4 = (ip) => {
      const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(ip ?? "");
      if (!m) return false;
      return m.slice(1).every((octet) => +octet <= 255);
    };

    const isIPv6 = (ip) => {
      if (!ip || !ip.includes(":")) return false;
      if (ip.includes("::") && ip.match(/::/g).length !== 1) return false;

      const compressed = ip.includes("::");
      let head, tail;

      if (compressed) {
        const parts = ip.split("::");
        head = parts[0] ? parts[0].split(":") : [];
        tail = parts[1] ? parts[1].split(":") : [];
      } else {
        const groups = ip.split(":");
        if (groups.length !== 8) return false;
        head = groups;
        tail = [];
      }

      const allGroups = head.concat(tail);
      if (compressed && allGroups.length > 7) return false;

      for (const g of allGroups) {
        if (g.includes(".")) {
          if (!isIPv4(g)) return false;
        } else if (!/^[0-9a-fA-F]{1,4}$/.test(g)) {
          return false;
        }
      }
      return true;
    };

    let ipv4 = null;
    let ipv6 = null;

    if (cfConnectingIPv4 && isIPv4(cfConnectingIPv4)) {
      ipv4 = cfConnectingIPv4;
    }

    if (cfConnectingIP) {
      if (isIPv6(cfConnectingIP)) {
        ipv6 = cfConnectingIP;
      } else if (isIPv4(cfConnectingIP) && !ipv4) {
        ipv4 = cfConnectingIP;
      }
    }

    const now = new Date();
    const pad = (n) => n.toString().padStart(2, "0");

    const timestamp =
      `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()} ` +
      `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;

    const timestampISO = now.toISOString();

    const result = {
      ip: ipv6 || ipv4 || "unknown",
      ipv4,
      ipv6,
      has_dual_stack: !!(ipv4 && ipv6),

      timestamp,
      timestamp_iso: timestampISO,

      country: cf.country ?? null,
      country_name: cf.countryName ?? getCountryName(cf.country),
      city: cf.city ?? null,
      region: cf.region ?? null,
      region_code: cf.regionCode ?? null,
      timezone: cf.timezone ?? null,
      continent: cf.continent ?? null,
      latitude: cf.latitude ?? null,
      longitude: cf.longitude ?? null,
      postal_code: cf.postalCode ?? null,

      asn: cf.asn ?? null,
      as_organization: cf.asOrganization ?? null,
      colo: cf.colo ?? null,

      http_protocol: cf.httpProtocol ?? null,
      tls_version: cf.tlsVersion ?? null,
      tls_cipher: cf.tlsCipher ?? null,

      user_agent: request.headers.get("User-Agent") ?? null,
      accept_language: request.headers.get("Accept-Language") ?? null,
      accept_encoding: cf.clientAcceptEncoding ?? null,
      request_method: request.method,

      is_eu_country: cf.isEUCountry === "1",
      client_tcp_rtt: cf.clientTcpRtt ?? null,
      edge_request_keep_alive_status: cf.edgeRequestKeepAliveStatus ?? null,
      request_priority: cf.requestPriority ?? null,
    };

    const filteredResult = Object.fromEntries(
      Object.entries(result).filter(([, v]) => v !== null)
    );

    return new Response(JSON.stringify(filteredResult, null, 2), {
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Cache-Control": "no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
        ...corsHeaders,
      },
    });
  },
};

function getCountryName(countryCode) {
  if (!countryCode) return null;
  try {
    return (
      new Intl.DisplayNames(["en"], { type: "region" }).of(countryCode) ||
      countryCode
    );
  } catch {
    return countryCode;
  }
}
