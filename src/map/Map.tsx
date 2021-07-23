import ReactMapGL, { MapEvent, Popup, WebMercatorViewport } from 'react-map-gl'
import 'mapbox-gl/dist/mapbox-gl.css'
import { Coordinate, QueryPoint } from '@/stores/QueryStore'
import React, { useState } from 'react'
import Dispatcher from '@/stores/Dispatcher'
import { MapIsLoaded, SetViewport } from '@/actions/Actions'
import { MapboxStyle } from '@/stores/MapOptionsStore'
import { ViewportStoreState } from '@/stores/ViewportStore'
import { PopupComponent } from '@/map/Popup'
import { MapLayer } from '@/layers/MapLayer'
import styles from './Map.module.css'

type MapProps = {
    viewport: ViewportStoreState
    queryPoints: QueryPoint[]
    mapStyle: MapboxStyle
    mapLayers: MapLayer[]
}

export default function ({ viewport, mapStyle, queryPoints, mapLayers }: MapProps) {
    const [popupCoordinate, setPopupCoordinate] = useState<Coordinate | null>(null)
    const longTouchHandler = new LongTouchHandler(e => setPopupCoordinate({ lng: e.lngLat[0], lat: e.lngLat[1] }))

    let interactiveLayerIds: string[] = []
    mapLayers.forEach(l => {
        if (l.interactiveLayerIds) interactiveLayerIds = interactiveLayerIds.concat(l.interactiveLayerIds)
    })
    return (
        <ReactMapGL
            mapStyle={mapStyle.style}
            {...viewport}
            width="100%"
            height="100%"
            mapOptions={{
                renderWorldCopies: false,
            }}
            onLoad={() => Dispatcher.dispatch(new MapIsLoaded())}
            onViewportChange={(nextViewport: ViewportStoreState) => {
                // close the context menu when we move the map
                setPopupCoordinate(null)
                // restrict zoom/pan such that we never see empty space left of/right of/above/under the map
                const bounds = new WebMercatorViewport(nextViewport).getBounds()
                if (bounds[0][0] < -180 || bounds[0][1] < -90 || bounds[1][0] > 180 || bounds[1][1] > 90) return
                Dispatcher.dispatch(new SetViewport(nextViewport))
            }}
            // todo: minor glitch: when we hover the map before the path got loaded we get an error in the console
            interactiveLayerIds={interactiveLayerIds}
            onClick={e => {
                const feature = e.features?.[0]
                if (feature) mapLayers.forEach(l => l.onClick(feature))
            }}
            onContextMenu={e => {
                e.preventDefault()
                setPopupCoordinate({ lng: e.lngLat[0], lat: e.lngLat[1] })
            }}
            onTouchStart={e => longTouchHandler.onTouchStart(e)}
            onTouchEnd={() => longTouchHandler.onTouchEnd()}
            onTouchMove={() => longTouchHandler.onTouchEnd()}
        >
            {popupCoordinate && (
                <Popup
                    longitude={popupCoordinate.lng}
                    latitude={popupCoordinate.lat}
                    closeOnClick={true}
                    closeButton={false}
                    className={styles.contextMenu}
                >
                    <PopupComponent
                        coordinate={popupCoordinate}
                        queryPoints={queryPoints}
                        onSelect={() => setPopupCoordinate(null)}
                    />
                </Popup>
            )}
            {...mapLayers.map((ml, i) => React.cloneElement(ml.layer, { key: i }))}
        </ReactMapGL>
    )
}

class LongTouchHandler {
    private readonly callback: (e: MapEvent) => void
    private currentTimeout: number = 0
    private currentEvent?: MapEvent

    constructor(onLongTouch: (e: MapEvent) => void) {
        this.callback = onLongTouch
    }

    onTouchStart(e: MapEvent) {
        this.currentEvent = e
        this.currentTimeout = window.setTimeout(() => {
            console.log('long touch')
            if (this.currentEvent) this.callback(this.currentEvent)
        }, 500)
    }

    onTouchEnd() {
        console.log('touch end')
        window.clearTimeout(this.currentTimeout)
        this.currentEvent = undefined
    }
}
