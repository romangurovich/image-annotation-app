-- Add UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create new tables with UUID primary keys
CREATE TABLE images_new (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  thumbnail_filename TEXT,
  user_ip TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE annotations_new (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images_new(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE chat_messages_new (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID NOT NULL REFERENCES annotations_new(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  user_ip TEXT NOT NULL DEFAULT 'unknown',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE image_shares_new (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images_new(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Migrate data from old tables to new tables
INSERT INTO images_new (id, filename, original_filename, thumbnail_filename, user_ip, created_at)
SELECT uuid_generate_v4(), filename, original_filename, thumbnail_filename, user_ip, created_at
FROM images;

-- Create a mapping table to track old ID to new UUID mapping for images
CREATE TEMP TABLE image_id_mapping AS
SELECT 
  old.id as old_id,
  new.id as new_id
FROM images old
JOIN images_new new ON old.filename = new.filename AND old.created_at = new.created_at;

-- Migrate annotations using the mapping
INSERT INTO annotations_new (id, image_id, x, y, radius, created_at)
SELECT 
  uuid_generate_v4(),
  mapping.new_id,
  a.x,
  a.y,
  a.radius,
  a.created_at
FROM annotations a
JOIN image_id_mapping mapping ON a.image_id = mapping.old_id;

-- Create annotation mapping for chat messages
CREATE TEMP TABLE annotation_id_mapping AS
SELECT 
  old.id as old_id,
  new.id as new_id
FROM annotations old
JOIN annotations_new new ON old.x = new.x AND old.y = new.y AND old.radius = new.radius AND old.created_at = new.created_at;

-- Migrate chat messages using the annotation mapping
INSERT INTO chat_messages_new (id, annotation_id, message, user_ip, created_at)
SELECT 
  uuid_generate_v4(),
  mapping.new_id,
  cm.message,
  cm.user_ip,
  cm.created_at
FROM chat_messages cm
JOIN annotation_id_mapping mapping ON cm.annotation_id = mapping.old_id;

-- Migrate image shares using the image mapping
INSERT INTO image_shares_new (id, image_id, share_token, created_at)
SELECT 
  uuid_generate_v4(),
  mapping.new_id,
  ish.share_token,
  ish.created_at
FROM image_shares ish
JOIN image_id_mapping mapping ON ish.image_id = mapping.old_id;

-- Drop old tables
DROP TABLE chat_messages;
DROP TABLE annotations;
DROP TABLE image_shares;
DROP TABLE images;

-- Rename new tables to original names
ALTER TABLE images_new RENAME TO images;
ALTER TABLE annotations_new RENAME TO annotations;
ALTER TABLE chat_messages_new RENAME TO chat_messages;
ALTER TABLE image_shares_new RENAME TO image_shares;

-- Recreate indexes
CREATE INDEX idx_image_shares_token ON image_shares(share_token);
CREATE INDEX idx_images_user_ip ON images(user_ip);
CREATE INDEX idx_images_thumbnail ON images(thumbnail_filename);
