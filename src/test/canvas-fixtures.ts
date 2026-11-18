import type { Canvas, CanvasDocument, CanvasEdge, CanvasNode } from '@shared/types'

export type CanvasFixtureOverrides = Partial<
  Omit<Canvas, 'schemaVersion' | 'activePageId' | 'pages'>
> & {
  nodes?: CanvasNode[]
  edges?: CanvasEdge[]
}

export function canvasV4(overrides: CanvasFixtureOverrides = {}): Canvas {
  const { nodes = [], edges = [], ...root } = overrides
  return {
    projectId: 'p1',
    title: '测试项目',
    gates: [],
    revision: 0,
    receipts: [],
    updatedAt: '2026-01-01T00:00:00.000Z',
    schemaVersion: 4,
    activePageId: 'page-1',
    activeView: 'canvas',
    ...root,
    pages: [{
      id: 'page-1',
      title: '页面 1',
      activeCanvasId: 'canvas-1',
      canvases: [{ id: 'canvas-1', title: '画布 1', nodes, edges, viewport: null }],
    }],
  }
}

export function activeDocument(canvas: Canvas): CanvasDocument {
  const page = canvas.pages.find(item => item.id === canvas.activePageId)
  const document = page?.canvases.find(item => item.id === page.activeCanvasId)
  if (!document) throw new Error('测试 fixture 缺少活动 CanvasDocument')
  return document
}

export function withActiveDocument(
  canvas: Canvas,
  patch: Partial<Pick<CanvasDocument, 'nodes' | 'edges'>>,
): Canvas {
  activeDocument(canvas)
  return {
    ...canvas,
    pages: canvas.pages.map(page => page.id !== canvas.activePageId ? page : {
      ...page,
      canvases: page.canvases.map(document => document.id !== page.activeCanvasId ? document : {
        ...document,
        ...patch,
      }),
    }),
  }
}
