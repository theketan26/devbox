import multer from 'multer';

// Use memoryStorage to stream buffer directly to Supabase Storage
export const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  }
});
