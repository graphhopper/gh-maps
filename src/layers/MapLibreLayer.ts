// We need this layer as OpenLayers own vector tiles background is much slower (not yet based on WebGL)
// And for navigation we really want vector tiles e.g. rotating labels, smoother zoom etc
// So we need this bridge to MapLibre but we had to add a postrender call.

// BSD 3-Clause License
//
// Copyright (c) 2019-present, camptocamp SA
// All rights reserved.
//
// See https://github.com/geoblocks/ol-maplibre-layer

import Layer from 'ol/layer/Layer.js'
import { toDegrees } from 'ol/math.js'
import { toLonLat } from 'ol/proj.js'

import maplibregl from 'maplibre-gl'
import type { FrameState } from 'ol/Map.js'
import RenderEvent from 'ol/render/Event'
import _default from 'ol/MapEventType'
import POSTRENDER = _default.POSTRENDER

export default class MapLibreLayer extends Layer {
    maplibreMap: maplibregl.Map

    constructor(style: string) {
        super({})
        const container = document.createElement('div')
        container.style.position = 'absolute'
        container.style.width = '100%'
        container.style.height = '100%'

        this.maplibreMap = new maplibregl.Map(
            Object.assign(
                {},
                { style: style },
                {
                    container: container,
                    attributionControl: false,
                    interactive: false,
                    trackResize: false,
                }
            )
        )

        this.applyOpacity_()
    }

    override disposeInternal() {
        this.maplibreMap.remove()
        super.disposeInternal()
    }

    override setOpacity(opacity: number) {
        super.setOpacity(opacity)
        this.applyOpacity_()
    }

    private applyOpacity_() {
        const canvas = this.maplibreMap.getCanvas()
        const opacity = this.getOpacity().toString()
        if (opacity !== canvas.style.opacity) {
            canvas.style.opacity = opacity
        }
    }

    override render(frameState: FrameState): HTMLElement {
        const viewState = frameState.viewState

        // adjust view parameters in maplibre
        this.maplibreMap.jumpTo({
            center: toLonLat(viewState.center) as [number, number],
            zoom: viewState.zoom - 1,
            bearing: toDegrees(-viewState.rotation),
        })

        const maplibreCanvas = this.maplibreMap.getCanvas()
        if (!maplibreCanvas.isConnected) {
            // The canvas is not connected to the DOM, request a map rendering at the next animation frame
            // to set the canvas size.
            this.getMapInternal()!.render()
        } else if (!sameSize(maplibreCanvas, frameState)) {
            this.maplibreMap.resize()
        }

        this.maplibreMap.redraw()

        // const layer = this.getLayer()
        this.dispatchEvent(new RenderEvent(POSTRENDER, undefined, frameState, undefined))

        return this.maplibreMap.getContainer()
    }
}

function sameSize(canvas: HTMLCanvasElement, frameState: FrameState): boolean {
    return (
        canvas.width === Math.floor(frameState.size[0] * frameState.pixelRatio) &&
        canvas.height === Math.floor(frameState.size[1] * frameState.pixelRatio)
    )
}
