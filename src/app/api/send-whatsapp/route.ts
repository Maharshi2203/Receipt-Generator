/**
 * ============================================================
 * WHATSAPP IMAGE SENDING - NEXT.JS API ROUTE (BACKEND)
 * ============================================================
 * 
 * WHY BACKEND IS REQUIRED:
 * ────────────────────────
 * Frontend JavaScript (running in browser) CANNOT send images
 * directly to WhatsApp because:
 * 
 * 1. WhatsApp does NOT have a public API that browsers can call
 * 2. The wa.me links only support plain TEXT, not images
 * 3. Sending media requires authenticated server-to-server calls
 * 4. Twilio API requires secret credentials (Account SID, Auth Token)
 *    that must NEVER be exposed in frontend code
 * 
 * HOW IT WORKS:
 * ─────────────
 * 1. Frontend captures receipt as base64 image using html2canvas
 * 2. Frontend sends base64 image + phone number to this API endpoint
 * 3. This backend converts base64 → PNG file and saves it
 * 4. Backend serves the image as a static file (public URL required by Twilio)
 * 5. Backend calls Twilio API to send WhatsApp message with image URL
 * 
 * IMAGE HOSTING:
 * ──────────────
 * Twilio requires a PUBLICLY ACCESSIBLE URL for media.
 * Options:
 *   a) Use ngrok to tunnel localhost (for development)
 *   b) Deploy to Vercel/Railway (for production)
 *   c) Upload to cloud storage (S3, Cloudinary, etc.)
 * 
 * For this implementation, we save the image to /public folder
 * and construct the URL using the app's base URL.
 * ============================================================
 */

import { NextRequest, NextResponse } from "next/server"
import { writeFile, mkdir } from "fs/promises"
import path from "path"

export async function POST(request: NextRequest) {
  try {
    // ──────────────────────────────────────────
    // Step 1: Parse incoming request body
    // ──────────────────────────────────────────
    const body = await request.json()
    const { image, phone } = body

    // ──────────────────────────────────────────
    // Step 2: Validate inputs
    // ──────────────────────────────────────────
    if (!image) {
      return NextResponse.json(
        { success: false, error: "Missing 'image' field (base64 string required)" },
        { status: 400 }
      )
    }

    if (!phone) {
      return NextResponse.json(
        { success: false, error: "Missing 'phone' field (e.g., '+919898354578')" },
        { status: 400 }
      )
    }

    // Basic phone validation: must start with + and have at least 10 digits
    const phoneRegex = /^\+\d{10,15}$/
    if (!phoneRegex.test(phone)) {
      return NextResponse.json(
        { success: false, error: "Invalid phone number. Use format: +919898354578" },
        { status: 400 }
      )
    }

    // ──────────────────────────────────────────
    // Step 3: Convert base64 image → PNG file
    // ──────────────────────────────────────────
    // Remove the "data:image/png;base64," prefix if present
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    // Create unique filename using timestamp
    const filename = `receipt_${Date.now()}.png`
    const uploadsDir = path.join(process.cwd(), "public", "uploads")

    // Ensure uploads directory exists
    await mkdir(uploadsDir, { recursive: true })

    const filePath = path.join(uploadsDir, filename)
    await writeFile(filePath, buffer)

    console.log(`✅ Receipt image saved: ${filePath}`)

    // ──────────────────────────────────────────
    // Step 4: Construct public URL for the image
    // ──────────────────────────────────────────
    // NOTE: For Twilio to access this image, it needs a PUBLIC URL.
    // In production, use your deployed domain.
    // In development, use ngrok to create a tunnel.
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"
    const imageUrl = `${baseUrl}/uploads/${filename}`

    // ──────────────────────────────────────────
    // Step 5: Send WhatsApp message via Twilio
    // ──────────────────────────────────────────
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioWhatsAppFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"

    if (!accountSid || !authToken) {
      // If Twilio is not configured, return the image URL for manual sharing
      console.warn("⚠️ Twilio credentials not configured. Returning image URL for manual sharing.")
      return NextResponse.json({
        success: true,
        message: "Image saved. Twilio not configured - use manual WhatsApp sharing.",
        imageUrl: imageUrl,
        manualShare: true,
        instructions: [
          "1. Twilio Account SID and Auth Token are not set in .env",
          "2. Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to your .env file",
          "3. The receipt image has been saved and can be shared manually",
          "4. Download link: " + imageUrl
        ]
      })
    }

    /**
     * TWILIO API CALL
     * ───────────────
     * Twilio uses Basic Auth with AccountSID:AuthToken
     * The WhatsApp sandbox number is: +14155238886
     * 
     * SETUP STEPS:
     * 1. Create account at https://www.twilio.com
     * 2. Go to Console → Messaging → Try it out → Send a WhatsApp message
     * 3. Join the sandbox by sending "join <your-sandbox-keyword>" to +14155238886
     * 4. Get Account SID and Auth Token from Console Dashboard
     * 5. Add them to .env file
     */
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const twilioBody = new URLSearchParams({
      From: twilioWhatsAppFrom,
      To: `whatsapp:${phone}`,
      Body: "Here is your receipt 🧾",
      MediaUrl: imageUrl
    })

    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: twilioBody.toString()
    })

    const twilioResult = await twilioResponse.json()

    if (!twilioResponse.ok) {
      console.error("❌ Twilio API Error:", twilioResult)
      return NextResponse.json(
        {
          success: false,
          error: "Twilio API failed",
          details: twilioResult.message || "Unknown Twilio error",
          code: twilioResult.code
        },
        { status: 500 }
      )
    }

    console.log(`✅ WhatsApp message sent to ${phone}, SID: ${twilioResult.sid}`)

    // ──────────────────────────────────────────
    // Step 6: Return success response
    // ──────────────────────────────────────────
    return NextResponse.json({
      success: true,
      message: `Receipt sent to WhatsApp (${phone})`,
      messageSid: twilioResult.sid,
      imageUrl: imageUrl
    })

  } catch (error: any) {
    console.error("❌ Server Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: "Internal server error",
        details: error.message || "Unknown error occurred"
      },
      { status: 500 }
    )
  }
}
