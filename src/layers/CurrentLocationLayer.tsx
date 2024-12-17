import React, { useEffect } from 'react'
import { Feature, Map } from 'ol'
import { Point } from 'ol/geom'
import { fromLonLat } from 'ol/proj'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { Icon, Style } from 'ol/style'
import { getCenter } from 'ol/extent'
import { TurnNavigationStoreState } from '@/stores/TurnNavigationStore'
import { Tile } from 'ol/layer'
import { getCurrentBackgroundLayers } from '@/layers/UseBackgroundLayer'

// This class renders just the arrow on the current location. The map rotation is done elsewhere and the arrow will
// always point to north.
export default function useCurrentLocationLayer(map: Map, turnNavigation: TurnNavigationStoreState) {
    const point = new Point(fromLonLat([turnNavigation.coordinate.lng, turnNavigation.coordinate.lat]))
    const feature = new Feature({ geometry: point })
    // Synchronize the position of the view animation (see MapActionReceiver) with the arrow via the "postrender" event.
    // Note that setting updateWhileAnimating = true for currentLocationLayer is necessary to see the animation.
    const onPostrender = () => point.setCoordinates(getCenter(map.getView().calculateExtent()))

    useEffect(() => {
        if (!turnNavigation.showUI) return
        const currentLocationLayer = addCurrentLocation(map, feature)

        // Attach the "postrender" event to the non-empty current background layer, because the event isn't triggered if the layer is empty.
        // Somehow the current location layer is empty for longer zoom durations e.g. here point=51.438901%2C14.245252&point=53.550341%2C10.000654&fake=10 and so it cannot be used.
        // If the background would be a VectorLayer we could just add the arrow as feature there but we allow raster layers
        // and so we need a separate layer.
        const layers = getCurrentBackgroundLayers(map)
        const backgroundLayer = layers.length > 0 ? (layers[0] as Tile<any>) : null
        if (backgroundLayer == null) console.error('Cannot find background layer ' + layers.length)
        else if (turnNavigation.settings.syncView) {
            console.log('Found background layer ' + layers.length)
            backgroundLayer.on('postrender', onPostrender)
        }

        return () => {
            if (!turnNavigation.showUI) return
            if (backgroundLayer == null) console.error('Cannot find background layer ' + JSON.stringify(layers))
            else if (turnNavigation.settings.syncView) backgroundLayer.un('postrender', onPostrender)
            map.removeLayer(currentLocationLayer)
        }
    }, [turnNavigation.showUI, turnNavigation.settings.syncView])
}

// we need a filled version of navigation.svg
const svgArrowData =
    '<svg xmlns="http://www.w3.org/2000/svg" height="50" width="50">' +
    '  <ellipse style="fill:rgba(255,255,255,0.6865);stroke:none;stroke-opacity:1" cx="25" cy="25" rx="25" ry="25" />' +
    '  <path style="fill:rgb(107,165,255);stroke:none;" d="M 24.776074,3.1477509 8.838421,39.50552 10.332578,40.99967 24.776074,34.425391 Z M 20.264723,30.914663 Z"/>' +
    '  <path style="fill:rgb(3,89,194);stroke:none;" d="M 24.772775,3.1435869 40.710421,39.50135 39.216266,40.995503 24.772775,34.421221 Z M 29.28412,30.910489 Z"/>' +
    '</svg>'

function addCurrentLocation(map: Map, feature: Feature) {
    const currentLocationLayer = new VectorLayer({
        source: new VectorSource({
            features: [feature],
        }),
        updateWhileAnimating: true,
        updateWhileInteracting: true,
    })
    currentLocationLayer.set('gh:current_location', true)
    currentLocationLayer.setZIndex(3)
    const style = new Style({
        image: new Icon({
            displacement: [0, 0],
            src: 'data:image/svg+xml;utf8,' + svgArrowData,
        }),
    })
    currentLocationLayer.setStyle(() => style)
    map.addLayer(currentLocationLayer)
    return currentLocationLayer
}
