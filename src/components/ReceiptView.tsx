"use client"

/**
 * ============================================================
 * RECEIPT VIEW COMPONENT
 * ============================================================
 * 
 * This component displays a generated receipt and provides
 * two action buttons:
 * 
 * 1. WhatsApp Button → Sends receipt IMAGE via backend API (Twilio)
 * 2. PDF Button → Downloads receipt as PDF file
 * 
 * ============================================================
 * WHY FRONTEND ALONE CANNOT SEND WHATSAPP IMAGES:
 * ────────────────────────────────────────────────
 * - WhatsApp has NO public browser API for sending media files
 * - The wa.me links (https://wa.me/?text=...) only support TEXT
 * - Sending images requires authenticated server-to-server calls
 * - Twilio API credentials (Account SID, Auth Token) are SECRET
 *   and must NEVER be exposed in frontend/browser code
 * - Therefore, a backend server (Node.js + Twilio) is REQUIRED
 * 
 * WHY BACKEND + TWILIO IS REQUIRED:
 * ──────────────────────────────────
 * - Twilio provides a WhatsApp Business API
 * - It accepts media via a public URL (mediaUrl parameter)
 * - The backend converts the base64 image to a file, hosts it,
 *   and sends it through Twilio's authenticated API
 * - This is the ONLY reliable way to programmatically send
 *   WhatsApp images without manual user intervention
 * 
 * HOW IMAGE HOSTING WORKS:
 * ────────────────────────
 * 1. Frontend captures receipt as base64 using html2canvas
 * 2. Frontend sends base64 + phone number to backend API
 * 3. Backend saves image as .png file in /public/uploads/
 * 4. Backend constructs a public URL for the image
 * 5. Backend sends the URL to Twilio's WhatsApp API
 * 6. Twilio downloads the image and sends it to WhatsApp
 * 
 * NOTE: For Twilio to access the image, the URL must be
 * publicly accessible. Use ngrok for development or deploy
 * to a cloud server for production.
 * ============================================================
 */

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Loader2 } from "lucide-react"
import { numberToWords, numberToGujaratiWords } from "@/lib/utils"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"

interface Receipt {
  receipt_number: number
  payer_name: string
  amount: number
  payment_mode: string
  description: string
  receipt_date: string
  created_at: string
  village?: string
}

interface ReceiptViewProps {
  receipt: Receipt
  companyName?: string
  onClose?: () => void
}

export function ReceiptView({ receipt, onClose }: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const [sharing, setSharing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const words = numberToWords(Math.floor(receipt.amount))
  const gujaratiWords = numberToGujaratiWords(Math.floor(receipt.amount))

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  // ──────────────────────────────────────────
  // WHATSAPP FUNCTION
  // ──────────────────────────────────────────
  /**
   * Steps:
   * 1. Capture receipt using html2canvas (scale: 2 for high resolution)
   * 2. Convert canvas to base64 image
   * 3. Send base64 image to backend using fetch POST request
   * 4. Include: { image: base64, phone: user number with country code }
   * 5. Show success/error alert after sending
   * 
   * The backend handles:
   * - Converting base64 → PNG file
   * - Hosting the image with a public URL
   * - Sending to WhatsApp via Twilio API
   */
  const handleWhatsAppShare = async () => {
    if (!receiptRef.current) return

    // Prevent duplicate clicks by disabling button while processing
    setSharing(true)

    try {
      // Step 1: Capture receipt container and convert to image using html2canvas
      // Using scale: 2 for high resolution output
      const canvas = await html2canvas(receiptRef.current, { scale: 2 })

      // Step 2: Convert canvas to base64 encoded PNG image
      const base64Image = canvas.toDataURL("image/png")

      // Step 3: Get the recipient phone number
      // Using the allowed phone from environment or prompt user
      const phone = process.env.NEXT_PUBLIC_ALLOWED_PHONE || "+919898354578"

      // Step 4: Send base64 image + phone to backend API using fetch POST
      const response = await fetch("/api/send-whatsapp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          image: base64Image,  // base64 encoded receipt image
          phone: phone         // phone number with country code
        })
      })

      const result = await response.json()

      // Step 5: Show appropriate alert based on response
      if (result.success) {
        if (result.manualShare) {
          // Twilio not configured — fallback to manual sharing
          // Download the image first
          const link = document.createElement("a")
          link.href = base64Image
          link.download = "receipt.png"
          link.click()

          // Open WhatsApp with text message
          // NOTE: This is a fallback — WhatsApp Web API only supports text
          // User must attach the downloaded image manually
          const message = encodeURIComponent("Here is your receipt.")
          window.open(`https://wa.me/?text=${message}`, "_blank")

          alert("📋 Twilio not configured yet.\n\nReceipt image downloaded!\nPlease attach it manually in WhatsApp.\n\nTo enable auto-send, configure Twilio credentials in .env file.")
        } else {
          // Success! Image sent via Twilio
          alert("✅ Receipt sent to WhatsApp successfully!")
        }
      } else {
        console.error("WhatsApp send failed:", result)
        alert("❌ Failed to send: " + (result.error || "Unknown error"))
      }
    } catch (error) {
      console.error("WhatsApp share error:", error)

      // Fallback: download image + open WhatsApp text
      try {
        const canvas = await html2canvas(receiptRef.current!, { scale: 2 })
        const imageData = canvas.toDataURL("image/png")
        const link = document.createElement("a")
        link.href = imageData
        link.download = "receipt.png"
        link.click()

        const message = encodeURIComponent("Here is your receipt.")
        window.open(`https://wa.me/?text=${message}`, "_blank")
      } catch (fallbackError) {
        console.error("Fallback failed:", fallbackError)
      }

      alert("⚠️ Could not connect to backend.\nReceipt image downloaded — attach manually in WhatsApp.")
    } finally {
      setSharing(false)
    }
  }

  // ──────────────────────────────────────────
  // PDF FUNCTION
  // ──────────────────────────────────────────
  /**
   * Steps:
   * 1. Capture receipt using html2canvas with scale: 2 for high resolution
   * 2. Convert canvas to base64 PNG image
   * 3. Initialize jsPDF with A4 portrait orientation ("p", "mm", "a4")
   * 4. Calculate correct width/height ratio to maintain aspect ratio
   *    - A4 width = 210mm
   *    - Height = canvas.height * 210 / canvas.width
   * 5. Add image to PDF at position (0, 0) with calculated dimensions
   * 6. Download as "receipt.pdf"
   */
  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return

    // Prevent duplicate clicks by disabling button while processing
    setDownloading(true)

    try {
      // Step 1: Capture receipt using html2canvas
      // scale: 2 ensures high resolution output
      const canvas = await html2canvas(receiptRef.current, { scale: 2 })

      // Step 2: Convert canvas to base64 PNG image
      const imgData = canvas.toDataURL("image/png")

      // Step 3: Initialize jsPDF
      // "p" = portrait orientation
      // "mm" = millimeters as unit
      // "a4" = A4 paper size (210mm x 297mm)
      const pdf = new jsPDF("p", "mm", "a4")

      // Step 4: Maintain correct width/height ratio
      // A4 width is 210mm, calculate proportional height
      const imgWidth = 210
      const imgHeight = (canvas.height * imgWidth) / canvas.width

      // Step 5: Add image to PDF at position (0, 0)
      pdf.addImage(imgData, "PNG", 0, 0, imgWidth, imgHeight)

      // Step 6: Download as "receipt.pdf"
      pdf.save("receipt.pdf")
    } catch (error) {
      console.error("PDF download error:", error)
      alert("❌ Failed to generate PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      {/* ──────────────────────────────────────── */}
      {/* ACTION BUTTONS: WhatsApp & PDF           */}
      {/* ──────────────────────────────────────── */}
      <div className="flex gap-4 justify-center px-2 print:hidden">
        {/* WhatsApp Button */}
        <Button
          id="whatsappBtn"
          size="lg"
          onClick={handleWhatsAppShare}
          disabled={sharing}
          className="flex-1 gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 h-14"
        >
          {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
          <span className="font-black uppercase text-xs tracking-widest">WhatsApp</span>
        </Button>

        {/* PDF Button */}
        <Button
          id="pdfBtn"
          size="lg"
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="flex-1 gap-2 rounded-2xl bg-zinc-950 text-[#FBE580] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100 h-14"
        >
          {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
          <span className="font-black uppercase text-xs tracking-widest">PDF</span>
        </Button>
      </div>

      {/* ──────────────────────────────────────── */}
      {/* RECEIPT CONTAINER (id="receipt")          */}
      {/* ──────────────────────────────────────── */}
      <div className="group px-1">
        <div className="overflow-hidden rounded-2xl shadow-2xl">
            <div
              id="receipt"
              ref={receiptRef}
              style={{
                backgroundColor: '#FDF8E8',
                width: "100%",
                maxWidth: "360px",
                margin: "0 auto",
                padding: "20px",
                fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif",
                boxSizing: 'border-box'
              }}
            >
              <div
                style={{
                  border: '4px double #8B4513',
                  backgroundColor: '#FDF8E8',
                  borderRadius: '12px',
                  padding: "24px",
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px'
                }}
              >
                {/* Header Section */}
                <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ color: '#8B4513', fontSize: '12px', fontWeight: 'bold', margin: 0 }}>
                    || શ્રી અંબેમાતાય નમઃ ||
                  </p>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <div
                      style={{
                        width: '48px',
                        height: '48px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderRadius: '50%',
                        border: '2px solid #8B4513',
                        backgroundColor: '#FDF8E8',
                        fontSize: '24px'
                      }}
                    >
                      🙏
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <h1 style={{ color: '#8B4513', fontSize: '18px', fontWeight: 'bold', margin: 0, lineHeight: '1.2' }}>
                      શ્રી જનકપુરિ નવરાત્રી યુવક મંડળ
                    </h1>
                    <p style={{ color: '#8B4513', fontSize: '10px', margin: 0, opacity: 0.8 }}>
                      જનકપુરિ સોસાયટી, બનવતપુરા, હિમતનગર
                    </p>
                  </div>
                </div>

                {/* Divider */}
                <div style={{ borderTop: '1px solid #8B4513', width: '100%' }} />

                {/* Number & Date Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px' }}>નંબર:</span>
                    <span
                      style={{
                        color: '#8B4513',
                        border: '1px solid #8B4513',
                        borderRadius: '4px',
                        padding: '2px 8px',
                        fontWeight: 'bold',
                        fontSize: '14px',
                        backgroundColor: 'white'
                      }}
                    >
                      #{receipt.receipt_number.toString().padStart(3, '0')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px' }}>તા.:</span>
                    <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px' }}>
                      {formatDate(receipt.receipt_date)}
                    </span>
                  </div>
                </div>

                {/* Name Section */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', width: '100%', borderBottom: '1px solid #8B4513', paddingBottom: '4px' }}>
                  <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '12px', whiteSpace: 'nowrap' }}>શ્રીમાન:</span>
                  <span
                    style={{
                      color: '#8B4513',
                      fontWeight: 'bold',
                      fontSize: '14px',
                      flex: 1,
                      textTransform: 'capitalize'
                    }}
                  >
                    {receipt.payer_name}
                  </span>
                </div>

                {/* Amount & Village Row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px' }}>રૂપિયા:</span>
                    <div
                      style={{
                        color: '#8B4513',
                        border: '2px solid #8B4513',
                        borderRadius: '8px',
                        backgroundColor: '#FEF3C7',
                        padding: '6px 12px',
                        fontWeight: 'bold',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        boxShadow: '0 2px 4px rgba(0,0,0,0.05)'
                      }}
                    >
                      <span style={{ fontSize: '14px' }}>₹</span>
                      <span style={{ fontSize: '18px' }}>{receipt.amount.toLocaleString()}</span>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flex: 1, justifyContent: 'flex-end' }}>
                    <span style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px', whiteSpace: 'nowrap' }}>ગામ:</span>
                    <span style={{ color: '#8B4513', borderBottom: '1px solid #8B4513', fontWeight: 'bold', fontSize: '12px', paddingBottom: '2px', textAlign: 'right', minWidth: '60px' }}>
                      {receipt.village || "જનકપુરિ"}
                    </span>
                  </div>
                </div>

                {/* Paragraph Text */}
                <div style={{ margin: '8px 0' }}>
                  <p
                    style={{
                      color: '#8B4513',
                      fontSize: '12px',
                      lineHeight: '1.8',
                      textAlign: 'justify',
                      margin: 0,
                      wordWrap: 'break-word'
                    }}
                  >
                    આપના તરફથી જનકપુરિ નવરાત્રી યુવક મંડળ ને ભેટ સ્વરૂપે રૂપિયા{' '}
                    <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{receipt.amount.toLocaleString()}</span>{' '}
                    અંકે રૂપિયા{' '}
                    <span style={{ fontWeight: 'bold', textDecoration: 'underline' }}>{gujaratiWords}</span>{' '}
                    મળ્યા છે. જે સાદર સ્વીકારેલ છે.
                  </p>
                </div>

                {/* Footer Section */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '12px', width: '100%' }}>
                  <div
                    style={{
                      width: '56px',
                      height: '56px',
                      borderRadius: '50%',
                      border: '1px dashed #8B4513',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      textAlign: 'center',
                      color: '#8B4513',
                      fontSize: '8px',
                      fontWeight: 'bold',
                      lineHeight: '1.2',
                      backgroundColor: 'rgba(139, 69, 19, 0.02)'
                    }}
                  >
                    જનકપુરિ<br/>હિમતનગર
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
                    <div
                      style={{
                        width: '120px',
                        borderBottom: '1px solid #8B4513',
                        opacity: 0.5
                      }}
                    />
                    <p style={{ color: '#8B4513', fontWeight: 'bold', fontSize: '11px', margin: 0 }}>
                      પ્રમુખ / મંત્રી
                    </p>
                  </div>
                </div>
              </div>
            </div>
        </div>
      </div>

    </div>
  )
}
