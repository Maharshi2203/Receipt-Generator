"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { MessageSquare, FileText, Loader2, ArrowLeft } from "lucide-react"
import { numberToWords, numberToGujaratiWords } from "@/lib/utils"
import html2canvas from "html2canvas"
import { jsPDF } from "jspdf"
import { supabase } from "@/lib/supabase"
import { uploadReceiptPDF } from "@/lib/receipt-service"

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
  const [sharing, setSharing] = useState(false)
  const [downloading, setDownloading] = useState(false)

  const gujaratiWords = numberToGujaratiWords(Math.floor(receipt.amount))

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const generatePDFBlob = async (): Promise<Blob> => {
    if (!receiptRef.current) throw new Error("Receipt element not found")
    
    const canvas = await html2canvas(receiptRef.current, { 
      scale: 3, // High resolution
      useCORS: true,
      logging: false,
      backgroundColor: "#FDF8E8"
    })

    const imgData = canvas.toDataURL("image/png")
    const pdf = new jsPDF("p", "mm", "a4")
    
    // Calculate dimensions to fit centered on A4
    const pageWidth = 210
    const pageHeight = 297
    const imgWidth = 140 // Slightly narrow for clean look
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    
    const x = (pageWidth - imgWidth) / 2
    const y = 20 // Margin from top

    pdf.addImage(imgData, "PNG", x, y, imgWidth, imgHeight)
    return pdf.output("blob")
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
      // 1. Generate PDF
      const pdfBlob = await generatePDFBlob()
      
      // 2. Upload using Service
      const response = await uploadReceiptPDF(pdfBlob, receipt.receipt_number)
      
      if (!response.success) throw new Error(response.error)
      
      const publicUrl = response.url
      
      // 3. Open WhatsApp link
      const phone = process.env.NEXT_PUBLIC_ALLOWED_PHONE || ""
      const message = encodeURIComponent(`Download your receipt from Orchids: ${publicUrl}`)
      const whatsappUrl = `https://wa.me/${phone.replace(/\+/g, "")}?text=${message}`
      
      window.open(whatsappUrl, "_blank")
    } catch (error: any) {
      console.error("WhatsApp sharing failed:", error)
      alert(`❌ WhatsApp share error: ${error.message || "Unknown error"}\n\nMake sure Supabase Storage 'receipts' bucket is public.`)
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
          className="h-14 rounded-2xl bg-[#25D366] hover:bg-[#128C7E] text-white font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
          WHATSAPP
        </Button>

        <Button
          onClick={handleDownloadPDF}
          disabled={downloading}
          className="h-14 rounded-2xl bg-black hover:bg-zinc-800 text-white font-bold shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
        >
          {downloading ? <Loader2 className="h-5 w-5 animate-spin" /> : <FileText className="h-5 w-5" />}
          PDF DOWNLOAD
        </Button>
      </div>

      {/* Receipt Element */}
      <div 
        ref={receiptRef}
        id="receipt-print-area"
        className="bg-[#FDF8E8] w-full border-[6px] border-double border-[#8B4513] rounded-2xl p-6 shadow-2xl relative overflow-hidden"
        style={{ width: "380px", margin: "0 auto" }}
      >
        {/* Decorative corner */}
        <div className="absolute top-0 right-0 w-16 h-16 border-t-2 border-r-2 border-[#8B4513]/20 rounded-tr-xl pointer-events-none" />
        
        <div className="space-y-6 text-[#8B4513]">
          {/* Header */}
          <div className="text-center space-y-2">
            <p className="text-[10px] font-bold tracking-widest opacity-80 uppercase">|| શ્રી અંબેમાતાય નમઃ ||</p>
            <div className="w-12 h-12 mx-auto rounded-full border-2 border-[#8B4513] flex items-center justify-center text-2xl bg-white shadow-inner">🙏</div>
            <h1 className="text-xl font-bold leading-tight">શ્રી જનકપુરિ નવરાત્રી યુવક મંડળ</h1>
            <p className="text-[10px] opacity-75">જનકપુરિ સોસાયટી, બનવતપુરા, હિમતનગર</p>
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
              <span className="text-xs font-bold">ગામ:</span>
              <div className="border-b border-[#8B4513] font-bold text-sm min-w-[80px] inline-block pb-1">
                {receipt.village || "જનકપુરિ"}
              </div>
            </div>
          </div>

          {/* Content Text */}
          <p className="text-xs leading-relaxed text-justify">
            આપના તરફથી જનકપુરિ નવરાત્રી યુવક મંડળ ને ભેટ સ્વરૂપે રૂપિયા{' '}
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
          <div className="flex justify-between items-center pt-4">
            <div className="w-14 h-14 rounded-full border border-dashed border-[#8B4513] flex items-center justify-center text-[8px] font-bold text-center leading-tight bg-[#8B4513]/5">
              જનકપુરિ<br/>હિમતનગર
            </div>
            <div className="text-center space-y-1">
              <div className="w-24 h-px bg-[#8B4513]/50 mx-auto" />
              <p className="text-[10px] font-bold">પ્રમુખ / મંત્રી</p>
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
