/**
 * Centralized API service for Stock Analyzer AI dashboard.
 * Supports running against:
 * 1. Vite dev middleware (relative URLs)
 * 2. Standalone FastAPI desktop sidecar (http://127.0.0.1:8765)
 */

const SIDECAR_URL = (window as any).__SIDECAR_URL__ || '';

export async function fetchApiData<T = any>(endpoint: string): Promise<T> {
  const url = `${SIDECAR_URL}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache'
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${endpoint}: ${response.statusText}`);
  }

  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    return response.json();
  }
  return response.text() as unknown as T;
}

export function subscribeToPipelineStream(
  onMessage: (data: { status: string; message: string }) => void,
  onError?: (err: any) => void
): () => void {
  const url = `${SIDECAR_URL}/api/pipeline/run-stream`;
  const eventSource = new EventSource(url);

  eventSource.onmessage = (event) => {
    try {
      const parsed = JSON.parse(event.data);
      onMessage(parsed);
      if (parsed.status === 'completed' || parsed.status === 'failed') {
        eventSource.close();
      }
    } catch (e) {
      console.error('Error parsing SSE event:', e);
    }
  };

  eventSource.onerror = (err) => {
    if (onError) onError(err);
    eventSource.close();
  };

  return () => {
    eventSource.close();
  };
}
