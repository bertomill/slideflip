// Backend WebSocket message types
export interface WebSocketMessage {
  type: string;
  data: any;
}

// File upload related types
export interface BackendFileInfo {
  filename: string;
  file_path: string;
  file_size: number;
  file_type: string;
  upload_time: string;
}

export interface FileUploadMessage {
  filename: string;
  content: string; // base64 encoded
  file_type: string;
  file_size: number;
}

// Slide description types
export interface SlideDescriptionMessage {
  description: string;
}

// Slide processing types
export interface SlideProcessingOptions {
  theme?: string;
  layout?: string;
  [key: string]: any;
}

export interface SlideElement {
  type: string;
  content: string;
  position: { x: number; y: number };
  style: Record<string, string>;
}

export interface BackendSlideData {
  title: string;
  content: string;
  theme: string;
  layout: string;
  elements: SlideElement[];
}

export interface BackendProcessingResult {
  status: 'idle' | 'started' | 'analyzing' | 'processing' | 'completed' | 'error';
  slide_data?: BackendSlideData;
  error_message?: string;
  processing_time: number;
}

// Processing status types
export type ProcessingStatus = 'idle' | 'started' | 'analyzing' | 'processing' | 'completed' | 'error';

// Message types for client to server
export interface ClientMessage {
  type: 'file_upload' | 'slide_description' | 'process_slide' | 'ping';
  data: FileUploadMessage | SlideDescriptionMessage | { options?: SlideProcessingOptions } | {};
}

// Message types for server to client
export interface ServerMessage {
  type: string;
  data: any;
}

export interface ConnectionEstablishedMessage {
  type: 'connection_established';
  data: {
    client_id: string;
    message: string;
    timestamp: string;
  };
}

export interface FileUploadSuccessMessage {
  type: 'file_upload_success';
  data: BackendFileInfo;
}

export interface FileUploadErrorMessage {
  type: 'file_upload_error';
  data: {
    error: string;
    details?: string;
  };
}

export interface SlideDescriptionSuccessMessage {
  type: 'slide_description_success';
  data: {
    description: string;
    length: number;
  };
}

export interface SlideDescriptionErrorMessage {
  type: 'slide_description_error';
  data: {
    error: string;
    details?: string;
  };
}

export interface ProcessingStatusMessage {
  type: 'processing_status';
  data: {
    status: ProcessingStatus;
    message: string;
    progress?: number;
    current_step?: string;
    total_steps?: number;
  };
}

export interface ProcessingCompleteMessage {
  type: 'processing_complete';
  data: {
    status: ProcessingStatus;
    slide_data: BackendSlideData;
    message: string;
  };
}

export interface ProcessingErrorMessage {
  type: 'processing_error';
  data: {
    error: string;
    details?: string;
  };
}

export interface PongMessage {
  type: 'pong';
  data: {
    timestamp?: string;
  };
}

export interface ErrorMessage {
  type: 'error';
  data: {
    error: string;
    details?: string;
  };
}

// Union type for all server messages
export type ServerMessageTypes = 
  | ConnectionEstablishedMessage
  | FileUploadSuccessMessage
  | FileUploadErrorMessage
  | SlideDescriptionSuccessMessage
  | SlideDescriptionErrorMessage
  | ProcessingStatusMessage
  | ProcessingCompleteMessage
  | ProcessingErrorMessage
  | PongMessage
  | ErrorMessage; 