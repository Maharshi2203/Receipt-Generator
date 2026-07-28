"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Loader2, ArrowLeft } from "lucide-react"
import { numberToWords, numberToGujaratiWords } from "@/lib/utils"
import { toPng } from "html-to-image"
import { jsPDF } from "jspdf"



interface Receipt {
  id?: string
  receipt_number: number
  payer_name: string
  amount: number
  payment_mode: string
  description: string
  receipt_date: string
  village?: string
}

interface ReceiptViewProps {
  receipt: Receipt
  onClose?: () => void
}

export function ReceiptView({ receipt, onClose }: ReceiptViewProps) {
  const receiptRef = useRef<HTMLDivElement>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pdfReady, setPdfReady] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(1)
  const [receiptHeight, setReceiptHeight] = useState<number | null>(null)
  const [signatureUrl, setSignatureUrl] = useState("/signature.png")
  // Pre-generated PDF blob stored here — avoids async before navigator.share()
  const pdfBlobRef = useRef<Blob | null>(null)

  // Process the signature scan on mount to be a clean transparent black PNG
  useEffect(() => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.src = "/signature.png"
    img.onload = () => {
      const canvas = document.createElement("canvas")
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext("2d")
      if (!ctx) return
      
      ctx.drawImage(img, 0, 0)
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const data = imgData.data
      
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i]
        const g = data[i+1]
        const b = data[i+2]
        
        // Calculate grayscale luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        
        // If it's a light background pixel (near white/bluish), make it transparent
        if (luminance > 180) {
          data[i+3] = 0 // Transparent alpha
        } else {
          // Make the ink dark black and preserve smooth edges
          data[i] = 0
          data[i+1] = 0
          data[i+2] = 0
          
          // Smooth out edge pixels based on luminance (darker = more opaque)
          const factor = (180 - luminance) / 180
          data[i+3] = Math.min(255, Math.round(factor * 2.5 * 255))
        }
      }
      
      ctx.putImageData(imgData, 0, 0)
      setSignatureUrl(canvas.toDataURL("image/png"))
    }
  }, [])

  const lastWidthRef = useRef<number>(0)
  const lastHeightRef = useRef<number>(0)

  // Resize observer for scaling
  useEffect(() => {
    if (!wrapperRef.current || !receiptRef.current) return
    const handleResize = () => {
      const wrapper = wrapperRef.current
      const receipt = receiptRef.current
      if (!wrapper || !receipt) return

      const wrapperWidth = wrapper.getBoundingClientRect().width
      // Use scrollHeight to capture the full unscaled height of the receipt
      const receiptHeightUnscaled = receipt.scrollHeight

      // If neither the wrapper width nor the receipt height has changed, skip state update to prevent layout loops
      if (
        wrapperWidth === lastWidthRef.current &&
        receiptHeightUnscaled === lastHeightRef.current
      ) {
        return
      }

      lastWidthRef.current = wrapperWidth
      lastHeightRef.current = receiptHeightUnscaled

      const targetWidth = 380
      if (wrapperWidth < targetWidth) {
        const newScale = wrapperWidth / targetWidth
        setScale(newScale)
        // Use the full scrollHeight for proper wrapper height after scaling
        setReceiptHeight(receiptHeightUnscaled * newScale)
      } else {
        setScale(1)
        setReceiptHeight(null)
      }
    }
    const observer = new ResizeObserver(handleResize)
    observer.observe(wrapperRef.current)
    observer.observe(receiptRef.current)
    handleResize()
    return () => observer.disconnect()
  }, [receipt, signatureUrl])

  /**
   * SHARED CAPTURE HELPER
   * ─────────────────────
   * Captures the on-screen receipt DOM node as a PNG via html-to-image and
   * embeds it into an A4 jsPDF document. Returns the jsPDF instance so both
   * the download path and the WhatsApp-share (blob) path can reuse it.
   *
   * pixelRatio 2 gives sharp output (~1 MB) without the 5.4 MB bloat that
   * pixelRatio 3 was producing.
   */
  const captureReceiptAsPDF = async (): Promise<jsPDF> => {
    if (!receiptRef.current) throw new Error("Receipt element not found")

    const el = receiptRef.current

    // Strip the CSS scale transform so html-to-image renders the full 380 px
    // receipt at its native size rather than the shrunk-to-fit mobile version.
    const prevTransform = el.style.transform
    const prevTransformOrigin = el.style.transformOrigin
    el.style.transform = "none"
    el.style.transformOrigin = "initial"

    try {
      // Wait for all custom web fonts to finish loading so the Gujarati text
      // (rendered via the system font stack) isn't captured as blank boxes.
      await document.fonts.ready

      // html-to-image supports modern CSS (oklch, oklab, etc.) unlike html2canvas.
      const dataUrl = await toPng(el, {
        pixelRatio: 2,                          // 2× is sharp enough; 3× caused 5.4 MB files
        backgroundColor: "#FDF8E8",
        style: { transform: "none", transformOrigin: "initial" },
      })

      // Measure the captured image dimensions so we can scale it proportionally
      // onto an A4 page without distorting the receipt layout.
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = dataUrl
      })

      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = 210          // A4 width in mm
      const imgWidth = 150           // receipt occupies 150 mm, centred
      const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth
      const x = (pageWidth - imgWidth) / 2
      const y = 20

      pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight)
      return pdf
    } finally {
      // Always restore the CSS transform even if capture throws.
      el.style.transform = prevTransform
      el.style.transformOrigin = prevTransformOrigin
    }
  }

  /**
   * BLOB HELPER (used only for the WhatsApp share path which needs a File object)
   * ──────────────────────────────────────────────────────────────────────────────
   * NOTE: We explicitly wrap the ArrayBuffer in a new Blob with
   * type:"application/pdf" because jsPDF's pdf.output("blob") returns a Blob
   * with type:"" (empty string). A typeless blob causes Chrome on Windows to
   * fall back to the internal blob UUID as the filename — producing the
   * "2937d4ba-6926-4932-a9b1-e26748c3ee30" downloads you saw.
   */
  const generatePDFBlob = async (): Promise<Blob> => {
    const pdf = await captureReceiptAsPDF()
    const bytes = pdf.output("arraybuffer")
    return new Blob([bytes], { type: "application/pdf" })
  }

  // Pre-generate PDF in background once receipt is rendered and signature is processed
  // Stored in ref so navigator.share() can be called synchronously on click
  useEffect(() => {
    // Only pre-generate when the signatureUrl is fully processed into base64
    if (signatureUrl === "/signature.png") return

    const timer = setTimeout(async () => {
      try {
        const blob = await generatePDFBlob()
        pdfBlobRef.current = blob
        setPdfReady(true)
      } catch (e) {
        console.warn("PDF pre-generation failed:", e)
      }
    }, 1000) // slight delay to let receipt and signature fully render
    return () => clearTimeout(timer)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [receipt, signatureUrl])

  const gujaratiWords = numberToGujaratiWords(Math.floor(receipt.amount))

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  /**
   * DOWNLOAD HANDLER
   * ────────────────
   * Uses jsPDF's own .save() method — the most cross-browser-reliable way to
   * trigger a named PDF download. It bypasses the blob-URL → anchor approach
   * that Chrome on Windows was mis-handling (ignoring the `download` attribute
   * and falling back to the blob UUID as the filename).
   *
   * Filename format: "Janakpuri_Receipt_001.pdf"
   */
  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const filename = `receipt-${receipt.receipt_number}.pdf`

      // Always re-capture for the download so we never serve a stale pre-built
      // blob that was constructed under the old (typeless) code path.
      const pdf = await captureReceiptAsPDF()

      // jsPDF.save() constructs its own anchor internally with the correct MIME
      // type and download attribute — no UUID risk, works on Chrome / Edge /
      // Firefox / Safari / Android / iOS.
      pdf.save(filename)
    } catch (error) {
      console.error("PDF generation failed:", error)
      alert("Failed to generate PDF. Please try again.")
    } finally {
      setDownloading(false)
    }
  }

  // SYNCHRONOUS click handler — PDF is pre-built, so navigator.share() fires
  // within the user gesture without any async gap (no NotAllowedError)
  const handleWhatsAppShare = () => {
    const blob = pdfBlobRef.current
    if (!blob) {
      alert("PDF is still generating, please wait a moment and try again.")
      return
    }

    const pdfFile = new File(
      [blob],
      `receipt-${receipt.receipt_number}.pdf`,
      { type: "application/pdf" }
    )

    // Mobile / desktop: open native OS share sheet with actual PDF file
    if (navigator.share && navigator.canShare?.({ files: [pdfFile] })) {
      navigator.share({
        title: `Receipt #${String(receipt.receipt_number).padStart(3, "0")}`,
        text: `Receipt for ${receipt.payer_name} — ₹${receipt.amount.toLocaleString()}`,
        files: [pdfFile],
      }).catch((err) => {
        if (err?.name !== "AbortError") {
          console.error("Share failed:", err)
          alert("Sharing failed. Try the PDF Download button instead.")
        }
      })
      return
    }

    // Fallback for browsers where file sharing isn't supported:
    // Download the PDF — user can then manually send via WhatsApp
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = `receipt-${receipt.receipt_number}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    alert("PDF saved! Open WhatsApp → choose contact → tap 📎 → select the PDF.")
  }


  return (
    <div className="max-w-[400px] mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 px-2 print:hidden">
        <Button
          onClick={handleWhatsAppShare}
          disabled={!pdfReady}
          className="h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 px-2"
        >
          {!pdfReady
            ? <><Loader2 className="h-5 w-5 animate-spin" /> Preparing...</>
            : <><MessageSquare className="h-5 w-5" /> WHATSAPP</>
          }
        </Button>

        <Button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="h-14 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 px-2"
        >
          {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
          PDF DOWNLOAD
        </Button>
      </div>

      {/* Receipt Element Wrapper (Dynamic Scale to Fit Mobile Viewports) */}
      <div 
        ref={wrapperRef} 
        className="w-full flex justify-center items-start print:overflow-visible" 
        style={receiptHeight ? { height: `${receiptHeight}px` } : undefined}
      >
        <div 
          ref={receiptRef}
          id="receipt-print-area"
          className="bg-[#FDF8E8] border-[6px] border-double border-[#8B4513] rounded-2xl pt-6 px-6 pb-8 shadow-2xl relative overflow-hidden flex-shrink-0"
          style={{ 
            width: "380px", 
            transform: `scale(${scale})`, 
            transformOrigin: "top center",
            margin: "0 auto"
          }}
        >


          <div className="space-y-6 text-[#8B4513]">
            {/* Header */}
            <div className="text-center space-y-2">
              <p className="text-[10px] font-bold tracking-widest opacity-80 uppercase">|| શ્રી અંબેમાતાય નમઃ ||</p>
              <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#8B4513] flex items-center justify-center text-2xl bg-white shadow-inner">🙏</div>
              <h1 className="text-xl font-bold leading-tight">શ્રી જનકપુરી નવરાત્રી યુવક મંડળ</h1>
              <p className="text-[10px] opacity-75">જનકપુરી સોસાયટી, બલવંતપુરા, હિંમતનગર</p>
            </div>

            <div className="h-px bg-[#8B4513]/30 w-full" />

            {/* Metadata */}
            <div className="flex justify-between items-center text-xs font-bold">
              <div className="flex items-center gap-2">
                <span>નંબર:</span>
                <span className="bg-white px-2 py-1 rounded border border-[#8B4513] text-sm">
                  #{receipt.receipt_number.toString().padStart(3, '0')}
                </span>
              </div>
              <div>
                <span>તા.: </span>
                <span>{formatDate(receipt.receipt_date)}</span>
              </div>
            </div>

            {/* Payer Name */}
            <div className="border-b border-[#8B4513] pb-1 flex gap-2 items-baseline">
              <span className="text-sm font-bold whitespace-nowrap">શ્રીમાન:</span>
              <span className="text-lg font-black flex-1 border-b-0">{receipt.payer_name}</span>
            </div>

            {/* Amount and Village */}
            <div className="flex justify-between items-end gap-4">
              <div className="space-y-1">
                <span className="text-xs font-bold">રૂપિયા:</span>
                <div className="bg-[#FEF3C7] border-2 border-[#8B4513] rounded-xl px-4 py-2 flex items-center gap-2 shadow-sm">
                  <span className="text-sm font-bold">₹</span>
                  <span className="text-2xl font-black">{receipt.amount.toLocaleString()}</span>
                </div>
              </div>
              <div className="flex-1 text-right space-y-1">
                <span className="text-xs font-bold">સોસાયટી:</span>
                <div className="border-b border-[#8B4513] font-bold text-sm min-w-[80px] inline-block pb-1">
                  {receipt.village || "જનકપુરી"}
                </div>
              </div>
            </div>

            {/* Content Text */}
            <p className="text-xs leading-relaxed text-justify">
              આપના તરફથી જનકપુરી નવરાત્રી યુવક મંડળ ને ભેટ સ્વરૂપે રૂપિયા{' '}
              <span className="font-bold underline decoration-[#8B4513]/40">
                {receipt.amount.toLocaleString()}
              </span>{' '}
              અંકે રૂપિયા{' '}
              <span className="font-bold underline decoration-[#8B4513]/40">
                {gujaratiWords}
              </span>{' '}
              મળ્યા છે. જે સાદર સ્વીકારેલ છે.
            </p>

            {/* Footer */}
            <div className="flex justify-between items-center -mt-5">
              <div className="w-14 h-14 rounded-full border border-dashed border-[#8B4513] flex items-center justify-center text-[8px] font-bold text-center leading-tight bg-[#8B4513]/5">
                જનકપુરી<br/>હિંમતનગર
              </div>
              <div className="text-center space-y-1 flex flex-col items-center">
                {/* Signature Image */}
                <div className="h-10 w-24 flex items-center justify-center -mb-2 pointer-events-none">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img 
                    src={signatureUrl} 
                    alt="Signature" 
                    className="h-12 object-contain"
                  />
                </div>
                <div className="w-24 h-px bg-[#8B4513]/50 mx-auto" />
                <p className="text-[10px] font-bold">પ્રમુખ / મંત્રી</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {onClose && (
        <Button 
          variant="ghost" 
          onClick={onClose} 
          className="w-full text-zinc-400 hover:text-zinc-600 font-bold"
        >
          <ArrowLeft className="mr-2 h-4 w-4" /> Back to Form
        </Button>
      )}
    </div>
  )
}
