// POST /api/plaid/link-token/investments
// Creates a Plaid Link token with the Investments product enabled.
// Used specifically for re-linking Merrill Lynch (and any other investment
// institution) to pull individual holdings data.
// Kept separate from the main link-token route so regular bank/card linking
// is never broken by the Investments product requirement.

import { NextResponse } from "next/server";
import { plaidClient, Products, CountryCode } from "@/lib/plaid";

export async function POST() {
  try {
    const response = await plaidClient.linkTokenCreate({
      user: { client_user_id: "rewards-app-user" },
      client_name: "Ascend HQ",
      products: [Products.Investments],
      country_codes: [CountryCode.Us],
      language: "en",
      redirect_uri: "https://rewards-app-tan.vercel.app/settings/accounts",
    });

    return NextResponse.json({ link_token: response.data.link_token });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: unknown } };
    console.error("[plaid/link-token/investments]", JSON.stringify(axiosErr?.response?.data ?? err));
    return NextResponse.json({ error: "Failed to create investment link token" }, { status: 500 });
  }
}
