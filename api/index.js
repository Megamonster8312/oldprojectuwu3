import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function handleProxy(request: NextRequest): Promise<Response> {
  const incomingUrl = new URL(request.url);

  // Construct target upstream URL
  const upstreamUrl = new URL(request.url);
  upstreamUrl.hostname = "de1.kvxos.co.uk";
  upstreamUrl.port = "9021";
  upstreamUrl.protocol = "http:";

  // Clone headers and rewrite the Host header
  const forwardHeaders = new Headers(request.headers);
  forwardHeaders.set("Host", upstreamUrl.host);

  forwardHeaders.delete("connection");
  forwardHeaders.delete("content-length");

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

    // Handle redirects to avoid loops and rewrite location
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

        return new NextResponse(upstreamResponse.body, {
          status: upstreamResponse.status,
          statusText: upstreamResponse.statusText,
          headers: redirectHeaders,
        });
      }
    }

    return new NextResponse(upstreamResponse.body, {
      status: upstreamResponse.status,
      statusText: upstreamResponse.statusText,
      headers: upstreamResponse.headers,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return new NextResponse(`Proxy Error: ${message}`, { status: 502 });
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const PATCH = handleProxy;
export const DELETE = handleProxy;
export const HEAD = handleProxy;
export const OPTIONS = handleProxy;
