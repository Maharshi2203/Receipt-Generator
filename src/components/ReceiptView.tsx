"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Download, Copy, Check, MessageSquare, FileText, Loader2 } from "lucide-react"
import { numberToWords, numberToGujaratiWords } from "@/lib/utils"
import { toPng } from "html-to-image"
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
  const [copied, setCopied] = useState(false)
  const [sharing, setSharing] = useState(false)

  const words = numberToWords(Math.floor(receipt.amount))
  const gujaratiWords = numberToGujaratiWords(Math.floor(receipt.amount))

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    const day = date.getDate().toString().padStart(2, '0')
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }

  const handleCopyText = () => {
    const text = `
🙏 *|| શ્રી અંબેમાતાય નમઃ ||*
━━━━━━━━━━━━━━━━━━━━
*શ્રી જનકપુરિ નવરાત્રી યુવક મંડળ*
જનકપુરિ સોસાયટી, બનવતપુરા, હિમતનગર

નંબર: #${receipt.receipt_number.toString().padStart(3, '0')}
તા.: ${formatDate(receipt.receipt_date)}
શ્રીમાન: ${receipt.payer_name}
ગામ: ${receipt.village || "જનકપુરિ"}
રૂપિયા: ₹${receipt.amount.toLocaleString()}
અક્ષરે: ${gujaratiWords} રૂપિયા

આપના તરફથી જનકપુરિ નવરાત્રી યુવક મંડળ ને ભેટ સ્વરૂપે રૂપિયા ${receipt.amount.toLocaleString()} અંકે રૂપિયા ${gujaratiWords} મળ્યા છે. જે સાદર સ્વીકારેલ છે.

પ્રમુખ / મંત્રી
━━━━━━━━━━━━━━━━━━━━
    `.trim()
    navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleWhatsAppShare = async () => {
    if (!receiptRef.current) return
    setSharing(true)
    
    try {
      const canvas = await html2canvas(receiptRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FDF8E8'
      })
      
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/png', 1.0)
      })
      
      const file = new File([blob], `receipt.png`, { type: 'image/png' })
      const message = `Here is your receipt for ₹${receipt.amount.toLocaleString()}`
      
      if (navigator.share && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: `Receipt #${receipt.receipt_number}`,
          text: message
        })
      } else {
        // Fallback for browsers that don't support file sharing
        const dataUrl = canvas.toDataURL("image/png")
        const link = document.createElement("a")
        link.download = `receipt.png`
        link.href = dataUrl
        link.click()
        
        // Open WhatsApp Web with the message
        const waUrl = `https://wa.me/?text=${encodeURIComponent(message)}`
        window.open(waUrl, "_blank")
      }
    } catch (error) {
      console.error('Share failed:', error)
      const waUrl = `https://wa.me/?text=${encodeURIComponent("Here is your receipt")}`
      window.open(waUrl, "_blank")
    } finally {
      setSharing(false)
    }
  }

  const handleDownloadPDF = async () => {
    if (!receiptRef.current) return
    const canvas = await html2canvas(receiptRef.current, {
      scale: 3,
      useCORS: true,
      backgroundColor: '#FDF8E8'
    })
    const imgData = canvas.toDataURL("image/png")
    const imgWidth = canvas.width
    const imgHeight = canvas.height
    const aspectRatio = imgHeight / imgWidth
    const pdfWidthMM = 100
    const pdfHeightMM = (pdfWidthMM * aspectRatio)
    const pdf = new jsPDF({
      orientation: "p",
      unit: "mm",
      format: [pdfWidthMM, pdfHeightMM]
    })
    pdf.addImage(imgData, "PNG", 0, 0, pdfWidthMM, pdfWidthMM * aspectRatio)
    pdf.save(`receipt.pdf`)
  }

  return (
    <div className="space-y-8 animate-in fade-in zoom-in-95 duration-700">
      <div className="flex gap-4 justify-center px-2 print:hidden">
        <Button 
          size="lg" 
          onClick={handleWhatsAppShare} 
          disabled={sharing} 
          className="flex-1 gap-2 rounded-2xl bg-emerald-600 text-white hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 h-14"
        >
          {sharing ? <Loader2 className="h-5 w-5 animate-spin" /> : <MessageSquare className="h-5 w-5" />}
          <span className="font-black uppercase text-xs tracking-widest">WhatsApp</span>
        </Button>
        <Button 
          size="lg" 
          onClick={handleDownloadPDF} 
          className="flex-1 gap-2 rounded-2xl bg-zinc-950 text-[#FBE580] hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-100 h-14"
        >
          <FileText className="h-5 w-5" />
          <span className="font-black uppercase text-xs tracking-widest">PDF</span>
        </Button>
      </div>

      <div className="group px-1">
        <div className="overflow-hidden rounded-2xl shadow-2xl">
            <div 
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
      
      {onClose && (
        <div className="px-2 pb-10 print:hidden">
          <Button variant="ghost" className="w-full h-16 rounded-[2rem] text-zinc-500 font-black uppercase text-[10px] tracking-[0.4em] hover:bg-white transition-all border border-black/5 shadow-inner" onClick={onClose}>
            Generate Another Receipt
          </Button>
        </div>
      )}
    </div>
  )
}
