-- Add thumbnail_filename column to images table
ALTER TABLE images ADD COLUMN thumbnail_filename TEXT;

-- Create index for faster lookups
CREATE INDEX idx_images_thumbnail ON images(thumbnail_filename);
