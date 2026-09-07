export const config = {
  runtime: "edge",
};

export default async function handler(request) {
  const incomingUrl = new URL(request.url);

  // Construct target upstream URL
  const upstreamUrl = new URL(request.url);
  upstreamUrl.hostname = "de1.kvxos.co.uk";
  upstreamUrl.port = "9021";
  upstreamUrl.protocol = "http:";

  // Clone headers and rewrite the Host header
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set("Host", upstreamUrl.host);

  // Strip hop-by-hop headers before forwarding
  forwardHeaders.delete("connection");
  forwardHeaders.delete("content-length");

  // Determine if the incoming request includes a body
  const methodsWithNoBody = ["GET", "HEAD"];
  const hasBody = !methodsWithNoBody.includes(request.method) && request.body !== null;

  try {
    const upstreamResponse = await fetch(upstreamUrl.toString(), {
      method: request.method,
      headers: forwardHeaders,
      body: hasBody ? request.body : undefined,
      redirect: "manual",
      cache: "no-store",
    });

    // Handle redirects to prevent loops and rewrite location back to this host
    if ([301, 302, 303, 307, 308].includes(upstreamResponse.status)) {
      let location = upstreamResponse.headers.get("Location");

      if (location) {
        if (location.startsWith("/")) {
          location = `${incomingUrl.protocol}//${incomingUrl.host}${location}`;
        } else {
          const targetHostString = "de1.kvxos.co.uk:9021";
          if (location.includes(targetHostString)) {
            location = location.replace(targetHostString, incomingUrl.host);
          }
        }

        const redirectHeaders = new Headers(upstreamResponse.headers);
        redirectHeaders.set("Location", location);

        return new Response(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: redirectHeaders,
        });
      }
    }

    // Forward the standard upstream response directly
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new Response(`Proxy Error: ${message}`, { status: 502 });
  }
}
