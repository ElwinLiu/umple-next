import type {
  CompileRequest, CompileResponse, ExampleCategory, GenerateRequest, GenerateResponse, ModelResponse,
  TaskCreateRequest, TaskCreateResponse, TaskResponse, TaskSubmitResponse,
  AiRequirementsResponse, AiExplainResponse,
} from './types'

const API_BASE = '/api'

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.json()
}

async function requestBlob(path: string, options?: RequestInit): Promise<Blob> {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }))
    throw new Error(err.error || res.statusText)
  }
  return res.blob()
}

export const api = {
  compile(req: CompileRequest, signal?: AbortSignal): Promise<CompileResponse> {
    return request('/compile', {
      method: 'POST',
      body: JSON.stringify(req),
      signal,
    })
  },

  listExamples(): Promise<ExampleCategory[]> {
    return request('/examples')
  },

  getExample(name: string): Promise<{ name: string; code: string }> {
    return request(`/examples/${encodeURIComponent(name)}`)
  },

  createModel(code: string): Promise<ModelResponse> {
    return request('/models', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  getModel(id: string): Promise<ModelResponse> {
    return request(`/models/${encodeURIComponent(id)}`)
  },

  updateModel(id: string, code: string): Promise<void> {
    return request(`/models/${encodeURIComponent(id)}`, {
      method: 'PUT',
      body: JSON.stringify({ code }),
    })
  },

  generate(req: GenerateRequest): Promise<GenerateResponse> {
    return request('/generate', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  // Task endpoints
  createTask(req: TaskCreateRequest): Promise<TaskCreateResponse> {
    return request('/tasks', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  getTask(id: string): Promise<TaskResponse> {
    return request(`/tasks/${encodeURIComponent(id)}`)
  },

  submitTask(id: string, code: string): Promise<TaskSubmitResponse> {
    return request(`/tasks/${encodeURIComponent(id)}/submit`, {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  // AI endpoints
  aiRequirements(requirements: string): Promise<AiRequirementsResponse> {
    return request('/ai/requirements', {
      method: 'POST',
      body: JSON.stringify({ requirements }),
    })
  },

  aiExplain(code: string): Promise<AiExplainResponse> {
    return request('/ai/explain', {
      method: 'POST',
      body: JSON.stringify({ code }),
    })
  },

  sync(req: { action: string; modelId: string; params: Record<string, string> }): Promise<{ code: string; result: string; errors?: string }> {
    return request('/sync', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  diagram(req: { code: string; diagramType: string; modelId?: string; suboptions?: string[] }): Promise<{ svg: string; layout?: import('./types').GvLayout; stateMachines?: import('./types').UmpleStateMachine[]; errors?: string }> {
    return request('/diagram', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  export(req: { code: string; format: string; modelId?: string }): Promise<Blob> {
    return requestBlob('/export', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },

  execute(req: { code: string; language: string; modelId?: string }): Promise<{ output: string; errors?: string }> {
    return request('/execute', {
      method: 'POST',
      body: JSON.stringify(req),
    })
  },
}
