import { v4 as uuidv4 } from 'uuid';
import { getSupabase } from './supabase.js';

export const SUPABASE_BUCKET_NAME = process.env.SUPABASE_STORAGE_BUCKET || 'devbox-files';

/**
 * Upload file strictly to Supabase private storage bucket (no local disk storage)
 * @param {Object} params
 * @param {Buffer} params.fileBuffer
 * @param {string} params.fileName
 * @param {string} params.mimeType
 * @param {string} params.folder (e.g. 'projects/123' or 'apps/456')
 */
export async function uploadFileToStorage({ fileBuffer, fileName, mimeType, folder }) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not configured. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in server/.env');
  }

  const fileId = uuidv4();
  const sanitizedFileName = (fileName || 'unnamed-file').replace(/[^a-zA-Z0-9._-]/g, '_');
  const storagePath = `${folder}/${fileId}-${sanitizedFileName}`;

  const { data, error } = await client.storage
    .from(SUPABASE_BUCKET_NAME)
    .upload(storagePath, fileBuffer, {
      contentType: mimeType || 'application/octet-stream',
      upsert: true
    });

  if (error) {
    console.error(`[Supabase Storage] Failed to upload ${storagePath}:`, error);
    let errorDetail = error.message;
    if (error.message?.includes('row-level security') || error.statusCode === '403') {
      errorDetail = `Private bucket '${SUPABASE_BUCKET_NAME}' access denied. To allow the backend to upload, please provide the Supabase Secret Key (service_role) in server/.env or add an RLS INSERT policy on bucket '${SUPABASE_BUCKET_NAME}'.`;
    }
    throw new Error(errorDetail);
  }

  console.log(`[Supabase Storage] Successfully uploaded to private bucket ${SUPABASE_BUCKET_NAME}: ${storagePath}`);

  return {
    fileId,
    fileName: sanitizedFileName,
    storageProvider: 'supabase',
    bucket: SUPABASE_BUCKET_NAME,
    storagePath: storagePath,
    sizeBytes: fileBuffer.length,
    mimeType: mimeType || 'application/octet-stream'
  };
}

/**
 * Get signed temporary URL for downloading from private Supabase bucket
 * @param {Object} fileRecord
 * @param {number} expiresInSeconds
 */
export async function getStorageDownloadUrl(fileRecord, expiresInSeconds = 3600) {
  const client = getSupabase();
  if (!client) {
    throw new Error('Supabase client is not configured.');
  }

  const bucket = fileRecord.bucket || SUPABASE_BUCKET_NAME;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(fileRecord.storage_path, expiresInSeconds);

  if (error || !data?.signedUrl) {
    console.error(`[Supabase Storage] Failed to create signed download URL:`, error);
    throw new Error(`Failed to generate signed download URL: ${error?.message || 'Unknown error'}`);
  }

  return {
    downloadUrl: data.signedUrl,
    fileName: fileRecord.file_name,
    mimeType: fileRecord.mime_type,
    provider: 'supabase',
    bucket: bucket,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString()
  };
}

/**
 * Delete file from Supabase private storage bucket
 * @param {Object} fileRecord
 */
export async function deleteFileFromStorage(fileRecord) {
  if (!fileRecord || !fileRecord.storage_path) return;
  const client = getSupabase();
  if (!client) return;

  const bucket = fileRecord.bucket || SUPABASE_BUCKET_NAME;
  try {
    const { error } = await client.storage.from(bucket).remove([fileRecord.storage_path]);
    if (error) {
      console.warn(`[Supabase Storage] Notice deleting file from ${bucket}:`, error.message);
    } else {
      console.log(`[Supabase Storage] Deleted ${fileRecord.storage_path} from ${bucket}`);
    }
  } catch (err) {
    console.warn(`[Supabase Storage] Delete exception:`, err.message);
  }
}
