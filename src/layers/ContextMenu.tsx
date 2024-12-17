import { Map, Overlay } from 'ol'
import { ContextMenuContent } from '@/map/ContextMenuContent'
import { useEffect, useRef, useState } from 'react'
import { Coordinate, QueryPoint } from '@/stores/QueryStore'
import { fromLonLat, toLonLat } from 'ol/proj'
import styles from '@/layers/ContextMenu.module.css'
import { RouteStoreState } from '@/stores/RouteStore'

interface ContextMenuProps {
    map: Map
    route: RouteStoreState
    queryPoints: QueryPoint[]
}

const overlay = new Overlay({
    autoPan: true,
})

export default function ContextMenu({ map, route, queryPoints }: ContextMenuProps) {
    const [menuCoordinate, setMenuCoordinate] = useState<Coordinate | null>(null)
    const container = useRef<HTMLDivElement | null>(null)

    const openContextMenu = (e: any) => {
        e.preventDefault()
        const coordinate = map.getEventCoordinate(e)
        const lonLat = toLonLat(coordinate)
        setMenuCoordinate({ lng: lonLat[0], lat: lonLat[1] })
    }

    const closeContextMenu = () => {
        setMenuCoordinate(null)
    }

    useEffect(() => {
        overlay.setElement(container.current!)
        map.addOverlay(overlay)

        const longTouchHandler = new LongTouchHandler(e => openContextMenu(e))

        function onMapTargetChange() {
            // it is important to setup new listeners whenever the map target changes, like when we switch between the
            // small and large screen layout, see #203

            // we cannot listen to right-click simply using map.on('contextmenu') and need to add the listener to
            // the map container instead
            // https://github.com/openlayers/openlayers/issues/12512#issuecomment-879403189
            map.getTargetElement().addEventListener('contextmenu', openContextMenu)

            map.getTargetElement().addEventListener('touchstart', e => longTouchHandler.onTouchStart(e))
            map.getTargetElement().addEventListener('touchmove', () => longTouchHandler.onTouchEnd())
            map.getTargetElement().addEventListener('touchend', () => longTouchHandler.onTouchEnd())

            map.getTargetElement().addEventListener('click', closeContextMenu)
        }
        map.on('change:target', onMapTargetChange)

        return () => {
            map.getTargetElement().removeEventListener('contextmenu', openContextMenu)
            map.getTargetElement().removeEventListener('click', closeContextMenu)
            map.removeOverlay(overlay)
            map.un('change:target', onMapTargetChange)
        }
    }, [map])

    useEffect(() => {
        overlay.setPosition(menuCoordinate ? fromLonLat([menuCoordinate.lng, menuCoordinate.lat]) : undefined)
    }, [menuCoordinate])

    return (
        <div className={styles.contextMenu} ref={container}>
            {menuCoordinate && (
                <ContextMenuContent
                    coordinate={menuCoordinate!}
                    queryPoints={queryPoints}
                    route={route}
                    onSelect={closeContextMenu}
                />
            )}
        </div>
    )
}

// See #229
class LongTouchHandler {
    private readonly callback: (e: any) => void
    private currentTimeout: number = 0
    private currentEvent?: any

    constructor(onLongTouch: (e: any) => void) {
        this.callback = onLongTouch
    }

    onTouchStart(e: any) {
        this.currentEvent = e
        this.currentTimeout = window.setTimeout(() => {
            console.log('long touch')
            if (this.currentEvent) this.callback(this.currentEvent)
        }, 500)
    }

    onTouchEnd() {
        // console.log('touch end')
        window.clearTimeout(this.currentTimeout)
        this.currentEvent = undefined
    }
}
