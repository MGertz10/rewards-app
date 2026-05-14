import { ImageResponse } from "next/og";

export const size = { width: 512, height: 512 };
export const contentType = "image/png";

export default function Icon() {
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
          borderRadius: "22%",
        }}
      >
        <span
          style={{
            color: "white",
            fontSize: 280,
            fontWeight: "800",
            lineHeight: 1,
            letterSpacing: "-12px",
            marginTop: "12px",
          }}
        >
          A
        </span>
      </div>
    ),
    { ...size }
  );
}
