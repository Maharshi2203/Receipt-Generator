const express = require("express")
const cors = require("cors")
const bodyParser = require("body-parser")
const fs = require("fs")
const path = require("path")
const multer = require("multer")

const app = express()
const PORT = process.env.PORT || 3001

// ──────────────────────────────────────────
// MIDDLEWARE CONFIGURATION
// ──────────────────────────────────────────

// Enable CORS so frontend (localhost:3000) can call this backend (localhost:3001)
app.use(cors({
    origin: ["http://localhost:3000", "http://127.0.0.1:3000", "*"],
    methods: ["POST", "GET"],
    credentials: true
}))

// Parse JSON bodies
app.use(bodyParser.json({ limit: "50mb" }))
app.use(bodyParser.urlencoded({ extended: true, limit: "50mb" }))

// Ensure uploads directory exists
const uploadsDir = path.join(__dirname, "uploads")
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true })
}

// ──────────────────────────────────────────
// MULTER SETUP (FOR PDF UPLOADS)
// ──────────────────────────────────────────
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir)
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9)
        cb(null, `receipt-${uniqueSuffix}.pdf`)
    }
})

const upload = multer({
    storage: storage,
    limits: { fileSize: 10 * 1024 * 1024 }
})

// Serve static files
app.use("/uploads", express.static(uploadsDir))

// Root route
app.get("/", (req, res) => {
    res.json({ status: "✅ Receipt Backend is running", port: PORT })
})

// ──────────────────────────────────────────
// API ENDPOINT: POST /upload-pdf
// ──────────────────────────────────────────
app.post("/upload-pdf", upload.single("pdf"), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, error: "No PDF file uploaded" })
        }

        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`
        const fileUrl = `${baseUrl}/uploads/${req.file.filename}`

        console.log(`✅ PDF uploaded: ${req.file.filename}`)

        return res.status(200).json({
            success: true,
            url: fileUrl,
            filename: req.file.filename
        })
    } catch (error) {
        console.error("❌ Upload error:", error)
        return res.status(500).json({ success: false, error: "Internal server error" })
    }
})

// ──────────────────────────────────────────
// API ENDPOINT: POST /send-whatsapp (Legacy Image Flow)
// ──────────────────────────────────────────
app.post("/send-whatsapp", async (req, res) => {
    try {
        const { image, phone } = req.body
        if (!image || !phone) return res.status(400).json({ success: false, error: "Missing data" })

        const base64Data = image.replace(/^data:image\/\w+;base64,/, "")
        const buffer = Buffer.from(base64Data, "base64")
        const filename = `receipt_${Date.now()}.png`
        const filePath = path.join(uploadsDir, filename)
        fs.writeFileSync(filePath, buffer)

        const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`
        const imageUrl = `${baseUrl}/uploads/${filename}`

        const accountSid = process.env.TWILIO_ACCOUNT_SID
        const authToken = process.env.TWILIO_AUTH_TOKEN
        if (!accountSid || !authToken) {
            return res.status(200).json({ success: true, manualShare: true, imageUrl })
        }

        const twilioFrom = process.env.TWILIO_WHATSAPP_FROM || "whatsapp:+14155238886"
        const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`
        const params = new URLSearchParams({
            From: twilioFrom,
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
            body: params.toString()
        })

        return res.status(200).json({ success: true, imageUrl })
    } catch (error) {
        return res.status(500).json({ success: false, error: error.message })
    }
})

// Cleanup
setInterval(() => {
    try {
        const files = fs.readdirSync(uploadsDir)
        const oneHourAgo = Date.now() - (60 * 60 * 1000)
        files.forEach(file => {
            const filePath = path.join(uploadsDir, file)
            const stat = fs.statSync(filePath)
            if (stat.mtimeMs < oneHourAgo) fs.unlinkSync(filePath)
        })
    } catch (e) {}
}, 30 * 60 * 1000)

app.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`)
})
