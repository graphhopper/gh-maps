declare module '*.css'
declare module '*.svg'
declare module '*.png'
declare module 'heightgraph/src/heightgraph'
declare module 'custom-model-editor/src/index'

interface Window {
    ghSaveFile: ({ fileName: string, mimeType: string, fileContents: xmlString }) => Promise<any>
}

declare module 'config' {
    const routingApi: string
    const geocodingApi: string
    const defaultTiles: string
    const navigationTiles: string
    const keys: {
        graphhopper: string
        omniscale: string
        maptiler: string
        thunderforest: string
        kurviger: string
    }
    const request: {
        details: string[]
        snapPreventions: string[]
    }
    const routingGraphLayerAllowed: boolean
    const externalMVTLayer: {
        url: string
        styles: {
            // Maps mvt layer names to style properties. Only the layers listed here will be visible.
            [key: string]: {
                color: string
                width: number
            }
        }
        maxZoom?: number
    }
    const profiles: object
}

declare module 'react-responsive' {
    function useMediaQuery(props: { query: string }): boolean
}

// defined by webpack
declare const GIT_SHA: string
