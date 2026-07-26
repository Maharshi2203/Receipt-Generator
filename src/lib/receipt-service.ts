import { supabase } from "./supabase"

/**
 * Receipt Service — Supabase Mode
 * All receipts are stored in Supabase Postgres.
 * PDFs are uploaded to Supabase Storage for WhatsApp sharing.
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

/** Extract a human-readable message from any error type (including Supabase PostgrestError) */
function extractMessage(error: any): string {
  if (!error) return "Unknown error"
  if (typeof error === "string") return error
  // Supabase PostgrestError has code, message, details, hint
  if (error.message) return error.message
  if (error.details) return error.details
  if (error.hint) return error.hint
  if (error.code) return `Supabase error code: ${error.code}`
  try { return JSON.stringify(error) } catch { return "Unknown error" }
}

/** Log a Supabase error with full details */
function logSupabaseError(label: string, error: any) {
  console.error(`❌ ${label}:`, {
    code: error?.code,
    message: error?.message,
    details: error?.details,
    hint: error?.hint,
  })
}

/**
 * Saves a new receipt to Supabase Database
 */
export async function saveReceipt(data: ReceiptData) {
  try {
    const { data: dbResult, error } = await supabase
      .from("receipts")
      .insert([data])
      .select()
      .single()

    if (error) {
      logSupabaseError("saveReceipt Supabase error", error)
      throw new Error(extractMessage(error))
    }

    return { success: true, data: dbResult }
  } catch (error: any) {
    const msg = extractMessage(error)
    console.error("❌ saveReceipt failed:", msg)
    return { success: false, error: msg }
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
      if (error.code === "PGRST116") return { success: true, data: null } // No rows found
      logSupabaseError("getLatestReceipt Supabase error", error)
      throw new Error(extractMessage(error))
    }
    return { success: true, data }
  } catch (error: any) {
    const msg = extractMessage(error)
    console.error("❌ getLatestReceipt failed:", msg)
    return { success: false, error: msg }
  }
}

/**
 * Fetches all receipts for a specific user (newest first)
 */
export async function getAllReceipts(userId: string) {
  try {
    const { data, error } = await supabase
      .from("receipts")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })

    if (error) {
      logSupabaseError("getAllReceipts Supabase error", error)
      throw new Error(extractMessage(error))
    }

    return { success: true, data: data ?? [] }
  } catch (error: any) {
    const msg = extractMessage(error)
    console.error("❌ getAllReceipts failed:", msg)
    return { success: false, error: msg }
  }
}

/**
 * Uploads a PDF blob to Supabase Storage and returns a public URL.
 * This public URL can be shared via WhatsApp.
 */
export async function uploadReceiptPDF(blob: Blob, receiptNumber: number) {
  try {
    const fileName = `public/receipt-${receiptNumber}-${Date.now()}.pdf`

    const { data, error } = await supabase.storage
      .from("receipts")
      .upload(fileName, blob, {
        contentType: "application/pdf",
        cacheControl: "3600",
        upsert: true,
      })

    if (error) {
      logSupabaseError("uploadReceiptPDF Supabase error", error)
      throw new Error(extractMessage(error))
    }

    const { data: { publicUrl } } = supabase.storage
      .from("receipts")
      .getPublicUrl(fileName)

    return { success: true, url: publicUrl }
  } catch (error: any) {
    const msg = extractMessage(error)
    console.error("❌ uploadReceiptPDF failed:", msg)
    return { success: false, error: msg }
  }
}
