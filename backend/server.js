/**
 * ============================================================
 * STANDALONE EXPRESS BACKEND - WhatsApp Image Sender
 * ============================================================
 * 
 * File: backend/server.js
 * 
 * This is an ALTERNATIVE standalone backend server using Express.js.
 * Use this if you want to run the backend separately from Next.js.
 * 
 * The primary backend is the Next.js API route at:
 *   /src/app/api/send-whatsapp/route.ts
 * 
 * ============================================================
 * WHY BACKEND + TWILIO IS REQUIRED:
 * ──────────────────────────────────
 * 1. Frontend (browser) JavaScript CANNOT send images to WhatsApp
 *    because WhatsApp has NO public browser API for media sending
 * 2. The wa.me links (https://wa.me/?text=...) only support TEXT
 * 3. Sending images requires server-side API calls to Twilio
 * 4. Twilio credentials (SID, Token) are SECRET and must never
 *    be exposed in client-side code
 * 5. Twilio requires a PUBLICLY ACCESSIBLE URL for media files
 * 
 * HOW IMAGE HOSTING WORKS:
 * ────────────────────────
 * Twilio's WhatsApp API needs a public URL to fetch the image.
 * Options for hosting:
 *   a) ngrok: Creates a tunnel to localhost (dev only)
 *      - Install: npm install -g ngrok
 *      - Run: ngrok http 3001
 *      - Use the https URL as BASE_URL in .env
 *   b) Cloud storage: Upload to S3/Cloudinary/Firebase Storage
 *   c) Deploy this server to Railway/Render/Heroku
 * 
 * TWILIO SETUP (Step-by-Step):
 * ────────────────────────────
 * 1. Go to https://www.twilio.com and create a FREE account
 * 2. Verify your phone number during signup
 * 3. Go to Console Dashboard → copy Account SID and Auth Token
 * 4. Go to Messaging → Try it out → Send a WhatsApp message
 * 5. You'll see a sandbox number: +14155238886
 * 6. From YOUR phone, send "join <keyword>" to +14155238886 on WhatsApp
 * 7. Once joined, you can send/receive messages through the sandbox
 * 8. Add credentials to .env file (see below)
 * ============================================================
 * 
 * ENVIRONMENT VARIABLES (.env file in /backend/):
 * ──────────────────────────────────────────────
 * TWILIO_ACCOUNT_SID=your_account_sid_here
 * TWILIO_AUTH_TOKEN=your_auth_token_here
 * TWILIO_WHATSAPP_FROM=whatsapp:+14155238886
 * BASE_URL=http://localhost:3001
 * PORT=3001
 * 
 * TO RUN:
 * ───────
 * cd backend
 * npm install
 * node server.js
 * ============================================================
 */

const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const fs = require("fs")
const path = require("path")

const app = express()
const PORT = process.env.PORT || 3001

// ──────────────────────────────────────────
// MIDDLEWARE CONFIGURATION
// ──────────────────────────────────────────

// Enable CORS so frontend (localhost:3000) can call this backend (localhost:3001)
app.use(cors({
  origin: ["http://localhost:3000", "http://127.0.0.1:3000"],
  methods: ["POST", "GET"],
  credentials: true
}))

// Parse JSON bodies (increase limit for base64 images which can be large)
app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }))

// Serve static files from 'uploads' directory
// This makes saved receipt images accessible via URL
app.use("/uploads", express.static(path.join(__dirname, "uploads")))

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true })
  console.log("📁 Created uploads directory")
}

// ──────────────────────────────────────────
// HEALTH CHECK ENDPOINT
// ──────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({
    status: "✅ WhatsApp Backend Server is running",
    endpoints: {
      "POST /send-whatsapp": "Send receipt image via WhatsApp"
    },
    timestamp: new Date().toISOString()
  })
})

// ──────────────────────────────────────────
// API ENDPOINT: POST /send-whatsapp
// ──────────────────────────────────────────
/**
 * Receives base64 receipt image + phone number
 * Converts to PNG file, saves it, sends via Twilio WhatsApp API
 * 
 * Request Body:
 * {
 *   "image": "data:image/png;base64,...",   // Base64 encoded receipt image
 *   "phone": "+919898354578"                // Phone number with country code
 * }
 * 
 * Response:
 * {
 *   "success": true,
 *   "message": "Receipt sent to WhatsApp (+919898354578)",
 *   "messageSid": "SM...",
 *   "imageUrl": "http://localhost:3001/uploads/receipt_123456.png"
 * }
 */
app.post("/send-whatsapp", async (req, res) => {
  try {
    const { image, phone } = req.body

    // ────────────────────────────────
    // INPUT VALIDATION
    // ────────────────────────────────

    // Validate image field
    if (!image) {
      return res.status(400).json({
        success: false,
        error: "Missing 'image' field. Send base64 encoded PNG image."
      })
    }

    // Validate phone field
    if (!phone) {
      return res.status(400).json({
        success: false,
        error: "Missing 'phone' field. Use format: +919898354578"
      })
    }

    // Validate phone format (must start with + followed by 10-15 digits)
    const phoneRegex = /^\+\d{10,15}$/
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: "Invalid phone number format. Use: +919898354578"
      })
    }

    // ────────────────────────────────
    // STEP 1: Convert base64 → PNG file
    // ────────────────────────────────
    // Remove the data URL prefix (e.g., "data:image/png;base64,")
    const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")

    // Create unique filename with timestamp to avoid conflicts
    const filename = `receipt_${Date.now()}.png`
    const filePath = path.join(uploadsDir, filename)

    // Save the image file to disk
    fs.writeFileSync(filePath, buffer)
    console.log(`✅ Receipt image saved: ${filePath}`)

    // ────────────────────────────────
    // STEP 2: Construct public image URL
    // ────────────────────────────────
    /**
     * IMAGE HOSTING EXPLAINED:
     * ────────────────────────
     * Twilio needs to DOWNLOAD the image from a URL.
     * In development, localhost is NOT accessible from internet.
     * 
     * SOLUTION: Use ngrok to create a public tunnel:
     *   1. Install: npm install -g ngrok
     *   2. Run: ngrok http 3001
     *   3. Copy the https URL (e.g., https://abc123.ngrok.io)
     *   4. Set BASE_URL in .env to that URL
     * 
     * In production, use your actual server domain.
     */
    const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`
    const imageUrl = `${baseUrl}/uploads/${filename}`
    console.log(`🌐 Image URL: ${imageUrl}`)

    // ────────────────────────────────
    // STEP 3: Send via Twilio WhatsApp API
    // ────────────────────────────────
    const accountSid = process.env.TWILIO_ACCOUNT_SID
    const authToken = process.env.TWILIO_AUTH_TOKEN
    const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"

    // Check if Twilio credentials are configured
    if (!accountSid || !authToken) {
      console.warn("⚠️ Twilio credentials not configured!")
      console.warn("Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env file")

      return res.status(200).json({
        success: true,
        message: "Image saved successfully. Twilio not configured — configure credentials to enable WhatsApp sending.",
        imageUrl: imageUrl,
        manualShare: true,
        setupInstructions: [
          "1. Create Twilio account at https://www.twilio.com",
          "2. Enable WhatsApp Sandbox in Console → Messaging",
          "3. Get Account SID and Auth Token from Dashboard",
          "4. Join sandbox: Send 'join <keyword>' to +14155238886 on WhatsApp",
          "5. Add to .env file:",
          "   TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx",
          "   TWILIO_AUTH_TOKEN=your_auth_token_here",
          "6. Use ngrok for public URL: ngrok http 3001",
          "7. Set BASE_URL in .env to your ngrok URL"
        ]
      })
    }

    /**
     * TWILIO API CALL
     * ───────────────
     * Uses Basic Authentication: AccountSID:AuthToken (base64 encoded)
     * Endpoint: POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
     * 
     * Parameters:
     *   From: whatsapp:+14155238886 (Twilio sandbox number)
     *   To: whatsapp:+91XXXXXXXXXX (recipient's WhatsApp number)
     *   Body: Text message to accompany the image
     *   MediaUrl: Public URL of the receipt image
     */
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`

    const params = new URLSearchParams({
      From: twilioFrom,
      To: `whatsapp:${phone}`,
      Body: "Here is your receipt 🧾",
      MediaUrl: imageUrl
    })

    // Make the API call to Twilio
    const twilioResponse = await fetch(twilioUrl, {
      method: "POST",
      headers: {
        "Authorization": "Basic " + Buffer.from(`${accountSid}:${authToken}`).toString("base64"),
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params.toString()
    })

    const twilioResult = await twilioResponse.json()

    // Handle Twilio API errors
    if (!twilioResponse.ok) {
      console.error("❌ Twilio API Error:", twilioResult)
      return res.status(500).json({
        success: false,
        error: "Twilio API failed to send WhatsApp message",
        details: twilioResult.message || "Unknown Twilio error",
        code: twilioResult.code
      })
    }

    console.log(`✅ WhatsApp message sent to ${phone}`)
    console.log(`   Message SID: ${twilioResult.sid}`)

    // ────────────────────────────────
    // STEP 4: Return success response
    // ────────────────────────────────
    return res.status(200).json({
      success: true,
      message: `Receipt sent to WhatsApp (${phone})`,
      messageSid: twilioResult.sid,
      imageUrl: imageUrl
    })

  } catch (error) {
    // ────────────────────────────────
    // ERROR HANDLING
    // ────────────────────────────────
    console.error("❌ Server Error:", error.message)
    return res.status(500).json({
      success: false,
      error: "Internal server error",
      details: error.message || "Unknown error occurred"
    })
  }
})

// ──────────────────────────────────────────
// CLEANUP: Delete old receipt images (older than 1 hour)
// ──────────────────────────────────────────
setInterval(() => {
  const files = fs.readdirSync(uploadsDir)
  const oneHourAgo = Date.now() - (60 * 60 * 1000)

  files.forEach(file => {
    const filePath = path.join(uploadsDir, file)
    const stat = fs.statSync(filePath)
    if (stat.mtimeMs < oneHourAgo) {
      fs.unlinkSync(filePath)
      console.log(`🗑️ Cleaned up old file: ${file}`)
    }
  })
}, 30 * 60 * 1000) // Run every 30 minutes

// ──────────────────────────────────────────
// START SERVER
// ──────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║  🚀 WhatsApp Backend Server                      ║
║  Running on: http://localhost:${PORT}               ║
║  POST /send-whatsapp - Send receipt via WhatsApp ║
╚══════════════════════════════════════════════════╝
  `)

  // Check Twilio configuration
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    console.log("⚠️  WARNING: Twilio credentials not found in environment!")
    console.log("   Add TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN to .env")
    console.log("   Server will save images but cannot send via WhatsApp.\n")
  } else {
    console.log("✅ Twilio credentials configured\n")
  }
})
