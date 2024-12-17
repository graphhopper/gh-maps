import Dispatcher from '@/stores/Dispatcher'
import { Map, View } from 'ol'
import { fromLonLat } from 'ol/proj'
import { MapIsLoaded } from '@/actions/Actions'
import { defaults as defaultControls } from 'ol/control'
import styles from '@/map/Map.module.css'
import { defaults, DragPan } from 'ol/interaction'

let map: Map | undefined

export function createMap(): Map {
    map = new Map({
        view: new View({
            enableRotation: true,
            constrainRotation: false,
            multiWorld: false,
            constrainResolution: true,
            center: fromLonLat([10, 10]),
            zoom: 2,
        }),
        interactions: defaults({
            pinchRotate: false, // do not allow changing rotation with touch as it is interferes on mobile when zooming and we don't have a button to reset to 0 yet
        }),
        controls: defaultControls({
            rotate: false, // for now also disable this extra button
            zoom: true,
            zoomOptions: {
                className: styles.customZoom,
            },
            attribution: true,
            attributionOptions: {
                className: styles.customAttribution,
                collapsible: false,
            },
        }),
    })
    map.once('postrender', () => {
        Dispatcher.dispatch(new MapIsLoaded())
    })
    return map
}

export function setMap(m: Map) {
    map = m
}
export function getMap(): Map {
    if (!map) throw Error('Map must be initialized before it can be used. Use "createMap" when starting the app')
    return map
}
