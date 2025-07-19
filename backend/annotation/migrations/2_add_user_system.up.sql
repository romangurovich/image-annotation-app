-- Add user_ip column to images table
ALTER TABLE images ADD COLUMN user_ip TEXT NOT NULL DEFAULT 'unknown';

-- Add user_ip column to chat_messages table  
ALTER TABLE chat_messages ADD COLUMN user_ip TEXT NOT NULL DEFAULT 'unknown';

-- Add sharing functionality
CREATE TABLE image_shares (
  id BIGSERIAL PRIMARY KEY,
  image_id BIGINT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for faster lookups
CREATE INDEX idx_image_shares_token ON image_shares(share_token);
CREATE INDEX idx_images_user_ip ON images(user_ip);
