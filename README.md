# Image Annotation Tool

A collaborative image annotation platform that allows users to upload images, create circular annotations, and engage in threaded discussions about specific areas of interest. Built with Encore.ts backend and React frontend.

## Features

### Core Functionality
- **Image Upload**: Upload images up to 10MB with automatic thumbnail generation
- **Interactive Annotations**: Create circular annotations by clicking and dragging on images
- **Threaded Chat**: Start conversations on any annotation with real-time messaging
- **Share Links**: Generate shareable links for collaborative annotation and discussion
- **User Management**: IP-based user identification with rate limiting

### Technical Features
- **Rate Limiting**: Protects against abuse with different limits for uploads, general API calls, and chat messages
- **Object Storage**: Secure image storage with public access for viewing
- **SQL Database**: Persistent storage for annotations, messages, and user data
- **Responsive Design**: Works seamlessly across desktop and mobile devices
- **Error Handling**: Comprehensive error handling with user-friendly messages

## Architecture

### Backend (Encore.ts)
The backend is built using Encore.ts and consists of a single `annotation` service with the following endpoints:

#### Image Management
- `POST /images/upload` - Create signed upload URLs for images and thumbnails
- `GET /images/:id` - Retrieve image data and metadata
- `GET /user/images` - List all images uploaded by the current user

#### Annotations
- `POST /annotations` - Create a new annotation circle on an image
- `GET /images/:imageId/annotations` - List all annotations for an image

#### Chat System
- `POST /annotations/:annotationId/messages` - Add a chat message to an annotation
- `GET /annotations/:annotationId/messages` - Retrieve all messages for an annotation

#### Sharing
- `POST /images/:imageId/share` - Create a shareable link for an image

### Frontend (React + TypeScript)
The frontend is a single-page application built with React, TypeScript, and Tailwind CSS:

#### Key Components
- **ImageUpload**: Handles file selection, validation, and upload with thumbnail generation
- **AnnotationScreen**: Main annotation interface with canvas-based drawing
- **ChatPanel**: Real-time chat interface for annotation discussions
- **UserImages**: Gallery view of user's uploaded images
- **ImageCanvas**: Read-only view for shared images

#### Routing
- `/` - Home page with upload interface
- `/my-images` - User's image gallery
- `/image/:imageId` - View-only mode for images
- `/annotate/:imageId` - Full annotation mode with editing capabilities
- `/image/:imageId?share=token` - Shared image access

## Database Schema

### Images Table
```sql
CREATE TABLE images (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  filename TEXT NOT NULL,
  original_filename TEXT NOT NULL,
  thumbnail_filename TEXT,
  user_ip TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Annotations Table
```sql
CREATE TABLE annotations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  x DOUBLE PRECISION NOT NULL,
  y DOUBLE PRECISION NOT NULL,
  radius DOUBLE PRECISION NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Chat Messages Table
```sql
CREATE TABLE chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  annotation_id UUID NOT NULL REFERENCES annotations(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  user_ip TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Image Shares Table
```sql
CREATE TABLE image_shares (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  image_id UUID NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  share_token TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

## Rate Limiting

The application implements IP-based rate limiting with different tiers:

- **General API calls**: 100 requests per minute
- **Image uploads**: 10 uploads per 5 minutes
- **Chat messages**: 50 messages per minute

Rate limits are enforced using an in-memory rate limiter that tracks requests by client IP address.

## User System

The application uses IP-based user identification rather than traditional authentication:

- Users are identified by their IP address (extracted from headers like `X-Forwarded-For`, `X-Real-IP`, or `CF-Connecting-IP`)
- Image ownership is tied to the IP address that uploaded the image
- Only image owners can create share links
- Shared users can view images and comment on annotations but cannot create new annotations

## File Structure

```
├── package.json                      # Root workspace configuration
├── bun.lock                          # Bun lock file
├── backend/
│   ├── encore.app                    # Encore application configuration
│   ├── package.json                  # Backend dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── annotation/                   # Main service
│   │   ├── encore.service.ts         # Service definition
│   │   ├── db.ts                     # Database configuration
│   │   ├── storage.ts                # Object storage configuration
│   │   ├── rate_limiter.ts          # Rate limiting implementation
│   │   ├── upload_image.ts          # Image upload endpoint
│   │   ├── get_image.ts             # Image retrieval endpoint
│   │   ├── list_user_images.ts      # User images listing
│   │   ├── create_annotation.ts     # Annotation creation
│   │   ├── list_annotations.ts      # Annotation listing
│   │   ├── add_chat_message.ts      # Chat message creation
│   │   ├── list_chat_messages.ts    # Chat message listing
│   │   ├── create_share_link.ts     # Share link generation
│   │   └── migrations/              # Database migrations
│   │       ├── 1_create_tables.up.sql
│   │       ├── 2_add_user_system.up.sql
│   │       ├── 3_add_thumbnails.up.sql
│   │       └── 4_convert_to_uuids.up.sql
│   └── frontend/                     # Frontend service (served by Encore)
│       ├── encore.service.ts         # Static assets service
│       └── dist/                     # Built frontend assets
└── frontend/                         # Source frontend application
    ├── package.json                  # Frontend dependencies
    ├── vite.config.ts                # Vite configuration
    ├── tsconfig.json                 # TypeScript configuration
    ├── index.html                    # HTML entry point
    ├── main.tsx                      # React entry point
    ├── App.tsx                       # Main application component
    ├── index.css                     # Global styles
    ├── client.ts                     # Generated API client
    └── components/
        ├── ImageUpload.tsx           # File upload interface
        ├── AnnotationScreen.tsx      # Main annotation interface
        ├── ChatPanel.tsx             # Chat messaging component
        ├── UserImages.tsx            # Image gallery
        ├── ImageCanvas.tsx           # Read-only image viewer
        ├── ImagePageContent.tsx      # Image page wrapper
        └── AnnotationPageContent.tsx # Annotation page wrapper
```

## Getting Started

### Prerequisites
- Bun (latest version)
- Encore CLI installed (`npm install -g @encore/cli`)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   bun install
   ```
3. Build the frontend (one-time setup):
   ```bash
   cd backend && bun run build
   ```
4. Run the development server:
   ```bash
   cd backend && bun run dev
   ```

The application will be available at:
- **Frontend & Backend**: `http://127.0.0.1:4000`
- **Development Dashboard**: `http://127.0.0.1:9400/image-annotation-app-y8zi`

### Project Structure

This is a monorepo using Bun workspaces:
- **Root**: Workspace configuration and shared dependencies
- **Backend**: Encore.ts application with API endpoints
- **Frontend**: React + Vite application built and served by Encore

### Configuration

No additional configuration is required for local development. The application uses:
- PostgreSQL database (automatically provisioned by Encore)
- Local object storage (automatically configured)
- In-memory rate limiting

For production deployment, Encore automatically provisions:
- PostgreSQL database
- Cloud object storage
- Proper networking and security

### Development Workflow

1. **Start development mode**: `cd backend && bun run dev`
   - This starts both Encore backend and Vite watch mode
   - Frontend automatically rebuilds when you make changes
2. **Make frontend changes**: Edit files in the `frontend/` directory
3. **Changes are automatic**: No manual rebuild needed!
4. **Access the app**: `http://127.0.0.1:4000`

**Alternative commands:**
- **Manual build**: `cd backend && bun run build`
- **Watch only**: `cd backend && bun run watch`
- **Backend only**: `cd backend && encore run`

**Note**: The frontend automatically rebuilds and is served by Encore. For even faster development, you could run a separate Vite dev server on a different port, but this requires CORS configuration.

## Usage

### Uploading Images
1. Visit the home page
2. Click "Choose File" and select an image (max 10MB)
3. The image will be uploaded and you'll be redirected to the annotation interface

### Creating Annotations
1. In annotation mode, click and drag on the image to create circular annotations
2. Minimum radius of 10 pixels is required
3. Click on any annotation circle to open the chat panel

### Chatting on Annotations
1. Click on an annotation circle to open the chat panel
2. Type messages up to 1000 characters
3. Messages are displayed with timestamps and user identifiers

### Sharing Images
1. As the image owner, click the "Share" button in annotation mode
2. A shareable link will be generated and copied to your clipboard
3. Shared users can view the image and comment on annotations but cannot create new ones

### Viewing Your Images
1. Click "My Images" from any page
2. View all your uploaded images with annotation counts
3. Click "View" for read-only mode or "Annotate" for full editing

## API Documentation

All API endpoints are automatically documented and type-safe through Encore.ts. The frontend automatically generates TypeScript types from the backend API definitions.

### Error Handling
The API returns standard HTTP status codes with detailed error messages:
- `400` - Invalid request parameters
- `403` - Permission denied
- `404` - Resource not found
- `409` - Resource already exists
- `429` - Rate limit exceeded
- `500` - Internal server error

### Rate Limit Headers
Rate limit information is included in error responses when limits are exceeded, including:
- Current limit
- Time until reset
- Remaining requests

## Security Considerations

- **Input Validation**: All user inputs are validated on both frontend and backend
- **Rate Limiting**: Prevents abuse through IP-based rate limiting
- **File Type Validation**: Only image files are accepted for upload
- **File Size Limits**: 10MB maximum file size for uploads
- **Message Length Limits**: 1000 character maximum for chat messages
- **SQL Injection Protection**: All database queries use parameterized statements
- **CORS**: Properly configured for cross-origin requests

## Performance Optimizations

- **Thumbnail Generation**: Automatic thumbnail creation for faster loading
- **Image Optimization**: Client-side image compression for thumbnails
- **Lazy Loading**: Images in gallery view are loaded on demand
- **Canvas Rendering**: Efficient canvas-based annotation rendering
- **Memory Management**: Automatic cleanup of rate limiting data

## Browser Compatibility

- Modern browsers with Canvas API support
- Clipboard API for share link copying (with fallback)
- File API for image uploads
- WebSocket support for real-time features (if added in future)

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.
