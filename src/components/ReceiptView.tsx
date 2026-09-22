"use client"

import { useRef, useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Loader2, ArrowLeft } from "lucide-react"
import { numberToWords, numberToGujaratiWords } from "@/lib/utils"
import { toPng, toBlob } from "html-to-image"
import { jsPDF } from "jspdf"
import { supabase } from "@/lib/supabase"
import { uploadReceiptPDF, uploadReceiptImage } from "@/lib/receipt-service"

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
  const [sharing, setSharing] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [scale, setScale] = useState(1)
  const [receiptHeight, setReceiptHeight] = useState<number | null>(null)
  const [signatureUrl, setSignatureUrl] = useState("/signature.png")

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
        
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b
        
        if (luminance > 180) {
          data[i+3] = 0 // Transparent alpha
        } else {
          data[i] = 0
          data[i+1] = 0
          data[i+2] = 0
          
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
      const receiptHeightUnscaled = receipt.scrollHeight

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

  const gujaratiWords = numberToGujaratiWords(Math.floor(receipt.amount))

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const generateImageBlob = async (): Promise<{ blob: Blob; dataUrl: string }> => {
    if (!receiptRef.current) throw new Error("Receipt element not found")
    
    const el = receiptRef.current
    const prevTransform = el.style.transform
    const prevTransformOrigin = el.style.transformOrigin
    
    el.style.transform = "none"
    el.style.transformOrigin = "initial"
    
    try {
      await document.fonts.ready

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#FDF8E8",
        style: { transform: "none", transformOrigin: "initial" }
      })

      const blob = await toBlob(el, {
        pixelRatio: 2,
        backgroundColor: "#FDF8E8",
        style: { transform: "none", transformOrigin: "initial" }
      })

      if (!blob) throw new Error("Failed to capture receipt image blob")

      return { blob, dataUrl }
    } finally {
      el.style.transform = prevTransform
      el.style.transformOrigin = prevTransformOrigin
    }
  }

  const generatePDFBlob = async (): Promise<Blob> => {
    if (!receiptRef.current) throw new Error("Receipt element not found")
    
    const el = receiptRef.current
    const prevTransform = el.style.transform
    const prevTransformOrigin = el.style.transformOrigin
    
    el.style.transform = "none"
    el.style.transformOrigin = "initial"
    
    try {
      await document.fonts.ready

      const dataUrl = await toPng(el, {
        pixelRatio: 2,
        backgroundColor: "#FDF8E8",
        style: { transform: "none", transformOrigin: "initial" }
      })

      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = dataUrl
      })

      const pdf = new jsPDF("p", "mm", "a4")
      const pageWidth = 210
      const imgWidth = 140
      const imgHeight = (img.naturalHeight * imgWidth) / img.naturalWidth
      const x = (pageWidth - imgWidth) / 2
      const y = 20

      pdf.addImage(dataUrl, "PNG", x, y, imgWidth, imgHeight)
      return pdf.output("blob")
    } finally {
      el.style.transform = prevTransform
      el.style.transformOrigin = prevTransformOrigin
    }
  }

  const handleDownloadPDF = async () => {
    setDownloading(true)
    try {
      const blob = await generatePDFBlob()
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `receipt-${receipt.receipt_number}.pdf`
      link.click()
      URL.revokeObjectURL(url)
    } catch (error) {
      console.error("PDF generation failed:", error)
      alert("Failed to generate PDF")
    } finally {
      setDownloading(false)
    }
  }

  const handleWhatsAppShare = async () => {
    setSharing(true)
    try {
      // 1. Generate Receipt Image (PNG)
      const { blob } = await generateImageBlob()
      const fileName = `receipt-${receipt.receipt_number}.png`
      const imageFile = new File([blob], fileName, { type: "image/png" })

      // 2. Try copying PNG image to Clipboard for instant Ctrl+V pasting in WhatsApp Web
      try {
        if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob })
          ])
        }
      } catch (clipErr) {
        console.log("Clipboard write image note:", clipErr)
      }

      // 3. Web Share API (Direct OS attachment on Mobile / desktop native WhatsApp)
      if (navigator.canShare && navigator.canShare({ files: [imageFile] })) {
        await navigator.share({
          files: [imageFile],
          title: `Receipt #${receipt.receipt_number}`,
          text: `Receipt #${receipt.receipt_number} for ${receipt.payer_name} (₹${receipt.amount.toLocaleString()})`
        })
        return
      }

      // 4. Upload PNG image to Supabase Storage & open WhatsApp with PNG Image URL preview
      const response = await uploadReceiptImage(blob, receipt.receipt_number)
      
      const phone = (process.env.NEXT_PUBLIC_ALLOWED_PHONE || "").replace(/\+/g, "")
      const publicUrl = response.success ? response.url : ""
      
      const textMessage = publicUrl
        ? `Receipt #${receipt.receipt_number} for ${receipt.payer_name} (₹${receipt.amount.toLocaleString()}):\n${publicUrl}`
        : `Receipt #${receipt.receipt_number} for ${receipt.payer_name} (₹${receipt.amount.toLocaleString()})`

      const message = encodeURIComponent(textMessage)
      const whatsappUrl = phone
        ? `https://wa.me/${phone}?text=${message}`
        : `https://api.whatsapp.com/send?text=${message}`
      
      window.open(whatsappUrl, "_blank")
    } catch (error: any) {
      console.error("WhatsApp sharing failed:", error)
      alert(`❌ WhatsApp share error: ${error.message || "Unknown error"}`)
    } finally {
      setSharing(false)
    }
  }

  return (
    <div className="max-w-[400px] mx-auto space-y-8 animate-in fade-in zoom-in-95 duration-500">
      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-4 px-2 print:hidden">
        <Button
          onClick={handleWhatsAppShare}
          disabled={sharing}
          className="h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] disabled:opacity-40 text-white font-bold text-xs sm:text-sm shadow-lg transition-all active:scale-95 flex items-center justify-center gap-1.5 sm:gap-2 px-2"
        >
          {sharing
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
