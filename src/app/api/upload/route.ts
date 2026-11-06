import { NextResponse } from "next/server";
import ImageKit from "imagekit";

const imagekit = new ImageKit({
  publicKey: process.env.NEXT_PUBLIC_IMAGEKIT_PUBLIC_KEY || "",
  privateKey: process.env.IMAGEKIT_PRIVATE_KEY || "",
  urlEndpoint: process.env.NEXT_PUBLIC_IMAGEKIT_URL_ENDPOINT || "",
});

// POST /api/upload - Upload zero-knowledge encrypted media blob to ImageKit
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { encryptedPayloadBase64, filename } = body;

    if (!encryptedPayloadBase64) {
      return NextResponse.json(
        { success: false, error: "Missing encrypted media payload." },
        { status: 400 }
      );
    }

    // Strict 3MB media size limit (3MB binary in base64 is ~4.2MB)
    const MAX_BASE64_BYTES = 4.5 * 1024 * 1024;
    if (typeof encryptedPayloadBase64 === "string" && encryptedPayloadBase64.length > MAX_BASE64_BYTES) {
      return NextResponse.json(
        { success: false, error: "Media size exceeds strict 3MB limit." },
        { status: 413 }
      );
    }

    if (!process.env.IMAGEKIT_PRIVATE_KEY) {
      return NextResponse.json(
        { success: false, error: "ImageKit storage not configured on server." },
        { status: 500 }
      );
    }

    const cleanName = (filename || "image").replace(/[^a-zA-Z0-9_-]/g, "");
    const safeName = `enc_${Date.now()}_${cleanName}.enc`;

    // Upload encrypted binary ciphertext blob directly to ImageKit
    const result = await imagekit.upload({
      file: encryptedPayloadBase64,
      fileName: safeName,
      folder: "/wechat-encrypted-media",
      useUniqueFileName: true,
      tags: ["e2ee-encrypted-blob"],
    });

    return NextResponse.json({
      success: true,
      url: result.url,
      fileId: result.fileId,
      name: result.name,
      zeroKnowledge: true,
      storage: "imagekit-cloud",
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "ImageKit upload failed";
    console.error("[ImageKit Upload Error]:", msg);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
