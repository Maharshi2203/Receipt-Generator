import { supabase } from "./supabase"

/**
 * Senior Developer Modular Receipt Service
 * Handles all database and storage operations
 */

export interface ReceiptData {
  payer_name: string
  amount: number
  receipt_date: string
  payment_mode?: string
  description?: string
  village?: string
  user_id: string
}

/**
 * Saves a new receipt to Supabase Database
 */
export async function saveReceipt(data: ReceiptData) {
  try {
    const { data: dbResult, error } = await supabase
      .from("receipts")
      .insert([data]) // Ensure it's passed as an array
      .select()
      .single()

    if (error) {
      console.error("❌ Supabase Error:", error.code, error.message, error.details)
      throw new Error(`[${error.code}] ${error.message} - ${error.details || ''}`)
    }
    
    return { success: true, data: dbResult }
  } catch (error: any) {
    console.error("❌ saveReceipt catch:", error)
    return { success: false, error: error.message || "Unknown database error" }
  }
}

/**
 * Fetches the latest receipt for a specific user
 */
export async function getLatestReceipt(userId: string) {
  try {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    if (error) {
       // Handle case where no receipt exists yet
       if (error.code === 'PGRST116') return { success: true, data: null }
       throw error
    }
    return { success: true, data }
  } catch (error: any) {
    console.error("❌ getLatestReceipt failed:", error)
    return { success: false, error: error.message }
  }
}

/**
 * Uploads a PDF blob to Supabase Storage
 * Returns the public URL
 */
export async function uploadReceiptPDF(blob: Blob, receiptNumber: number) {
  try {
    const fileName = `public/receipt-${receiptNumber || Date.now()}-${Math.random().toString(36).substring(7)}.pdf`
    
    // Upload to 'receipts' bucket
    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, blob, {
        contentType: 'application/pdf',
        cacheControl: '3600',
        upsert: true
      })

    if (error) throw error

    // Get Public URL
    const { data: { publicUrl } } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName)

    return { success: true, url: publicUrl }
  } catch (error: any) {
    console.error("❌ uploadReceiptPDF failed:", error)
    return { success: false, error: error.message }
  }
}
