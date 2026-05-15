// POST /api/plaid/link-token
// Creates a Plaid Link token to initialise the Link flow on the client.

import { NextRequest, NextResponse } from "next/server";
import { plaidClient, Products, CountryCode } from "@/lib/plaid";

export async function POST(req: NextRequest) {
  try {
    // redirect_uri: where Chase/CapOne OAuth redirects back to.
    // Use env var if set, otherwise derive from request origin so it works on any domain.
    const origin = req.headers.get("origin") ?? new URL(req.url).origin;
    const redirectUri =
      process.env.PLAID_REDIRECT_URI ??
      `${origin}/settings/accounts`;

    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "rewards-app-user" },
      client_name: "Ascend HQ",
      products: [Products.Transactions],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: redirectUri,
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown; status?: number } };
    const plaidError = axiosErr?.response?.data;
    console.error("[plaid/link-token]", JSON.stringify(plaidError ?? err));
    // Surface real Plaid error to client so it's visible in the UI
    return NextResponse.json(
      { error: "Failed to create link token", details: plaidError ?? String(err) },
      { status: 500 }
    );
  }
}
