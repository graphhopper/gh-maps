import 'ol/ol.css'
import styles from '@/map/Map.module.css'
import { useEffect, useRef } from 'react'
import { Map } from 'ol'
import { Coordinate, getBBoxFromCoord } from '@/stores/QueryStore'
import { Bbox } from '@/api/graphhopper'
import Dispatcher from '@/stores/Dispatcher'
import { ErrorAction } from '@/actions/Actions'
import { tr } from '@/translation/Translation'

type MapComponentProps = {
    map: Map
}

/** A small react component that simply attaches our map instance to a div to show the map **/
export default function ({ map }: MapComponentProps) {
    const mapElement = useRef<HTMLDivElement | null>(null)
    useEffect(() => {
        map.setTarget(mapElement.current!)
    }, [map])
    return <div ref={mapElement} className={styles.mapContainer} />
}

export function onCurrentLocationSelected(
    onSelect: (queryText: string, street: string, coordinate: Coordinate | undefined, bbox: Bbox | undefined) => void
) {
    if (!navigator.geolocation) {
        Dispatcher.dispatch(new ErrorAction('Geolocation is not supported in this browser'))
        return
    }

    onSelect(tr('searching_location') + ' ...', '', undefined, undefined)
    navigator.geolocation.getCurrentPosition(
        position => {
            const coordinate = { lat: position.coords.latitude, lng: position.coords.longitude }
            onSelect(tr('current_location'), '', coordinate, getBBoxFromCoord(coordinate))
        },
        error => {
            Dispatcher.dispatch(new ErrorAction(tr('searching_location_failed') + ': ' + error.message))
            onSelect('', '', undefined, undefined)
        },
        // DO NOT use e.g. maximumAge: 5_000 -> getCurrentPosition will then never return on mobile firefox!?
        { timeout: 300_000, enableHighAccuracy: true }
    )
}

export function onCurrentLocationButtonClicked(onSelect: (coordinate: Coordinate | undefined) => void) {
    if (!navigator.geolocation) {
        Dispatcher.dispatch(new ErrorAction('Geolocation is not supported in this browser'))
        onSelect(undefined)
        return
    }

    navigator.geolocation.getCurrentPosition(
        position => {
            onSelect({ lat: position.coords.latitude, lng: position.coords.longitude })
        },
        error => {
            Dispatcher.dispatch(new ErrorAction(tr('searching_location_failed') + ': ' + error.message))
            onSelect(undefined)
        },
        // DO NOT use e.g. maximumAge: 5_000 -> getCurrentPosition will then never return on mobile firefox!?
        { timeout: 300_000, enableHighAccuracy: true }
    )
}
