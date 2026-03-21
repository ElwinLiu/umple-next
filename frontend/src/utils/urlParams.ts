export interface UmpleUrlParams {
  example?: string
  model?: string
  text?: string
  task?: string
  diagramtype?: string
  generateDefault?: string
  readOnly?: boolean
  nochrome?: boolean
  nodiagram?: boolean
  notext?: boolean
  nomenu?: boolean
  showlayout?: boolean
  displayoptions?: string
}

export function parseUrlParams(): UmpleUrlParams {
  const params = new URLSearchParams(window.location.search)

  return {
    example: params.get('example') || undefined,
    model: params.get('model') || undefined,
    text: params.get('text') || undefined,
    task: params.get('task') || undefined,
    diagramtype: params.get('diagramtype') || undefined,
    generateDefault: params.get('generateDefault') || undefined,
    readOnly: params.has('readOnly'),
    nochrome: params.has('nochrome'),
    nodiagram: params.has('nodiagram'),
    notext: params.has('notext'),
    nomenu: params.has('nomenu'),
    showlayout: params.has('showlayout'),
    displayoptions: params.get('displayoptions') || undefined,
  }
}
