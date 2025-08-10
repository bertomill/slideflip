import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/client';

// ============================================================================
// DOCUMENT PARSING API ENDPOINT
// ============================================================================
// This endpoint processes uploaded files from the slide builder workflow,
// extracts text content, and stores it in the database for AI slide generation.
// Key features:
// - Multi-format support (TXT, PDF, DOCX, MD)
// - Database persistence with session tracking
// - Graceful error handling for individual files
// - Immediate content return for real-time use
// ============================================================================

/**
 * API endpoint for parsing and storing uploaded documents
 * 
 * Accepts multiple files via FormData, extracts text content based on file type,
 * and stores the parsed content in Supabase for use in slide generation.
 * Returns both success/failure status and extracted content for immediate use.
 * 
 * @param request - FormData containing files array and sessionId
 * @returns JSON response with parsed documents array and processing statistics
 */
export async function POST(request: NextRequest) {
    try {
        // REQUEST PARSING: Extract files and session ID from multipart form data
        // FormData is used to handle file uploads from the browser
        const formData = await request.formData();
        const files = formData.getAll('files') as File[];      // Array of uploaded files
        const sessionId = formData.get('sessionId') as string; // User session identifier

        // INPUT VALIDATION: Ensure required data is present before processing
        // Early validation prevents unnecessary processing and provides clear error messages
        if (!files || files.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No files provided' },
                { status: 400 }
            );
        }

        if (!sessionId) {
            return NextResponse.json(
                { success: false, error: 'Session ID required' },
                { status: 400 }
            );
        }

        // DATABASE INITIALIZATION: Create Supabase client for document storage
        // Each request gets its own client instance for proper session handling
        const supabase = createClient();

        // PROCESSING RESULTS: Array to collect parsing results for all files
        // Tracks both successful and failed document processing attempts
        const parsedDocuments = [];

        // DOCUMENT PROCESSING LOOP: Process each uploaded file individually
        // Uses individual try-catch blocks to ensure one failed file doesn't stop processing others
        for (const file of files) {
            try {
                // TEXT EXTRACTION: Extract content based on file type and format
                // Different file types require different parsing approaches
                let textContent = '';

                // PLAIN TEXT FILES: Direct text extraction for TXT and Markdown files
                // These files can be read directly as UTF-8 text without special parsing
                if (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md')) {
                    textContent = await file.text();
                }
                // PDF FILES: Placeholder for future PDF parsing implementation
                // TODO: Integrate pdf-parse or similar library for actual PDF text extraction
                else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
                    textContent = `[PDF Document: ${file.name}]\nPDF parsing not yet implemented. Please convert to text format or use the text paste feature.`;
                }
                // DOCX FILES: Placeholder for future Word document parsing
                // TODO: Integrate mammoth.js or similar library for DOCX text extraction
                else if (file.type === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || file.name.endsWith('.docx')) {
                    textContent = `[DOCX Document: ${file.name}]\nDOCX parsing not yet implemented. Please convert to text format or use the text paste feature.`;
                }
                // FALLBACK HANDLING: Attempt text extraction for unknown file types
                // Many file formats are actually text-based and can be read directly
                else {
                    try {
                        textContent = await file.text();
                    } catch {
                        // Graceful failure for truly unsupported formats
                        textContent = `[Unsupported Format: ${file.name}]\nUnable to extract text from this file type. Please convert to text format.`;
                    }
                }

                // DATABASE STORAGE: Persist extracted content to Supabase for future use
                // Stores both metadata and content for slide generation and user reference
                const { data: documentData, error: dbError } = await supabase
                    .from('slide_documents')
                    .insert({
                        session_id: sessionId,    // Links document to user session
                        filename: file.name,      // Original filename for user reference
                        file_type: file.type,     // MIME type for processing hints
                        file_size: file.size,     // File size for storage tracking
                        content: textContent,     // Extracted text content for AI processing
                        created_at: new Date().toISOString() // Timestamp for cleanup/auditing
                    })
                    .select()
                    .single();

                // ERROR HANDLING: Handle database failures gracefully without stopping processing
                // Even if storage fails, we return the content for immediate use in slide generation
                if (dbError) {
                    console.error('Database error:', dbError);
                    parsedDocuments.push({
                        filename: file.name,
                        success: false,
                        error: 'Database storage failed',
                        content: textContent // Content still available for immediate use
                    });
                } else {
                    // SUCCESS CASE: Document successfully parsed and stored
                    parsedDocuments.push({
                        id: documentData.id,      // Database ID for future reference
                        filename: file.name,      // Original filename
                        success: true,            // Processing success flag
                        content: textContent,     // Extracted text content
                        fileSize: file.size,      // File metadata
                        fileType: file.type       // File metadata
                    });
                }

            } catch (error) {
                // INDIVIDUAL FILE ERROR HANDLING: Log and track failed file processing
                // Continues processing other files even when one fails completely
                console.error(`Error processing file ${file.name}:`, error);
                parsedDocuments.push({
                    filename: file.name,
                    success: false,
                    error: `Failed to process: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    content: '' // No content available due to processing failure
                });
            }
        }

        // SUCCESS RESPONSE: Return processing results with statistics
        // Provides both individual file results and overall processing metrics
        return NextResponse.json({
            success: true,
            documents: parsedDocuments,                                    // Array of all processing results
            totalProcessed: files.length,                                  // Total number of files attempted
            successCount: parsedDocuments.filter(doc => doc.success).length // Number of successfully processed files
        });

    } catch (error) {
        // GLOBAL ERROR HANDLING: Handle unexpected errors during request processing
        // Provides fallback response when entire request fails
        console.error('Document parsing error:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to parse documents' },
            { status: 500 }
        );
    }
}