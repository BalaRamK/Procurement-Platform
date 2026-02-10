import { ImageResponse } from "next/og";

export const runtime = "edge";

export async function GET() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#2563eb",
          borderRadius: 6,
          fontSize: 32,
          fontWeight: 700,
          color: "white",
        }}
      >
        P
      </div>
    ),
    { width: 32, height: 32 }
  );
}
