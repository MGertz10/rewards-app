// POST /api/plaid/link-token
// Creates a Plaid Link token to initialise the Link flow on the client.

import { NextResponse } from "next/server";
import { plaidClient, Products, CountryCode } from "@/lib/plaid";

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "rewards-app-user" },
      client_name: "Ascend HQ",
      products: [Products.Transactions],
      // Investments is optional — Plaid enables it when the institution
      // supports it (brokerage/IRA accounts) and silently skips it for
      // banks and credit cards. This means a single link flow works for
      // both transaction accounts and investment accounts.
      optional_products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: "https://rewards-app-tan.vercel.app/settings/accounts",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown } };
    console.error("[plaid/link-token] Plaid error:", JSON.stringify(axiosErr?.response?.data ?? err));
    return NextResponse.json({ error: "Failed to create link token" }, { status: 500 });
  }
}
