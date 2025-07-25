import { pool } from "@/src/database"
import { sleep } from "@/src/lib/utils"
import { publishMeasurementArchived } from "@/src/pathways/pathways"
import { NextRequest, NextResponse } from "next/server"

/**
 * POST /api/measurements/[measurementId]/archive
 * Archive a measurement with secret word authentication
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ measurementId: string }> }
) {
  try {
    const { measurementId } = await params
    const body = await request.json()
    const { secretWord, archivedBy, archiveReason } = body

    // Simple secret word validation (in production, use proper authentication)
    if (secretWord !== 'archive') {
      return NextResponse.json({
        success: false,
        error: "Invalid secret word"
      }, { status: 401 })
    }

    if (!archivedBy) {
      return NextResponse.json({
        success: false,
        error: "archivedBy is required"
      }, { status: 400 })
    }

    // Check if measurement exists and is not already archived
    const client = await pool.connect()
    try {
      const checkResult = await client.query(
        'SELECT id, archived FROM measurements WHERE id = $1',
        [measurementId]
      )

      if (checkResult.rows.length === 0) {
        return NextResponse.json({
          success: false,
          error: "Measurement not found"
        }, { status: 404 })
      }

      if (checkResult.rows[0].archived) {
        return NextResponse.json({
          success: false,
          error: "Measurement is already archived"
        }, { status: 400 })
      }

    } finally {
      client.release()
    }

    // Publish measurement archived event
    await publishMeasurementArchived({
      measurementId,
      archivedBy,
      archiveReason,
      archivedAt: new Date()
    })

    // Wait for transformer processing
    await sleep(300)

    return NextResponse.json({
      success: true,
      message: "Measurement archived successfully"
    })

  } catch (error) {
    console.error("Measurement archive error:", error)

    return NextResponse.json({
      success: false,
      error: "Failed to archive measurement",
      message: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 })
  }
} 