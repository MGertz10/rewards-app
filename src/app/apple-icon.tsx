import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "linear-gradient(145deg, #188FE6 0%, #0A5FA8 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          // Apple touch icons use no border-radius — iOS clips them
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 100,
            fontWeight: "800",
            lineHeight: 1,
            letterSpacing: "-4px",
            marginTop: "6px",
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size }
  );
}
