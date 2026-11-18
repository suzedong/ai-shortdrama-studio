import type { Canvas, CanvasDocument, CanvasPage } from '@shared/types'

export function activeCanvasPage(canvas: Canvas): CanvasPage {
  return canvas.pages.find(page => page.id === canvas.activePageId)!
}

export function activeCanvasDocument(canvas: Canvas): CanvasDocument {
  const page = activeCanvasPage(canvas)
  return page.canvases.find(document => document.id === page.activeCanvasId)!
}

export function canvasDocumentById(canvas: Canvas, pageId: string, canvasId: string): CanvasDocument | null {
  return canvas.pages.find(page => page.id === pageId)
    ?.canvases.find(document => document.id === canvasId) ?? null
}
