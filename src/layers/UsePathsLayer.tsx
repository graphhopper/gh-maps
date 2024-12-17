import { Feature, Map } from 'ol'
import { Path } from '@/api/graphhopper'
import { FeatureCollection } from 'geojson'
import { useEffect } from 'react'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { Stroke, Style } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { Select } from 'ol/interaction'
import { click } from 'ol/events/condition'
import Dispatcher from '@/stores/Dispatcher'
import { SetSelectedPath } from '@/actions/Actions'
import { SelectEvent } from 'ol/interaction/Select'
import { TurnNavigationStoreState } from '@/stores/TurnNavigationStore'
import { RouteStoreState } from '@/stores/RouteStore'
import { Geometry, LineString } from 'ol/geom'
import { QueryPoint } from '@/stores/QueryStore'
import { distance } from 'ol/coordinate'

const pathsLayerKey = 'pathsLayer'
const selectedPathLayerKey = 'selectedPathLayer'
const accessNetworkLayerKey = 'accessNetworkLayer'

export default function usePathsLayer(
    map: Map,
    route: RouteStoreState,
    queryPoints: QueryPoint[],
    turnNavigation: TurnNavigationStoreState
) {
    useEffect(() => {
        removeCurrentPathLayers(map)
        if (turnNavigation.showUI && turnNavigation.activePath) {
            addSelectedPathsLayer(map, turnNavigation.activePath, true)
        } else {
            addUnselectedPathsLayer(
                map,
                route.routingResult.paths.filter(p => p != route.selectedPath)
            )
            addSelectedPathsLayer(map, route.selectedPath, false)
            addAccessNetworkLayer(map, route.selectedPath, queryPoints)
        }
        return () => {
            removeCurrentPathLayers(map)
        }
    }, [map, route.routingResult.paths, route.selectedPath, turnNavigation.showUI, turnNavigation.activePath])
}

function removeCurrentPathLayers(map: Map) {
    map.getLayers()
        .getArray()
        .filter(l => l.get(pathsLayerKey) || l.get(selectedPathLayerKey) || l.get(accessNetworkLayerKey))
        .forEach(l => map.removeLayer(l))
}

function addUnselectedPathsLayer(map: Map, paths: Path[]) {
    const styleArray = [
        new Style({
            stroke: new Stroke({
                color: 'rgba(39,93,173,1)',
                width: 6,
            }),
        }),
        new Style({
            stroke: new Stroke({
                color: 'rgba(201,217,241,0.8)',
                width: 4,
            }),
        }),
    ]
    const layer = new VectorLayer({
        source: new VectorSource({
            features: paths.map((path: Path, index) => {
                const f = new Feature({
                    index: index,
                })
                if (path.points?.coordinates)
                    f.setGeometry(new LineString(path.points.coordinates.map(c => fromLonLat(c))))
                return f
            }),
        }),
        style: styleArray,
        opacity: 0.7,
        zIndex: 1,
    })
    layer.set(pathsLayerKey, true)
    map.addLayer(layer)

    // select an alternative path if clicked
    removeSelectPathInteractions(map)
    const select = new Select({
        condition: click,
        layers: [layer],
        style: null,
        hitTolerance: 5,
    })
    select.on('select', (e: SelectEvent) => {
        const index = e.selected[0].getProperties().index
        Dispatcher.dispatch(new SetSelectedPath(paths[index]))
    })
    select.set('gh:select_path_interaction', true)
    map.addInteraction(select)
}

function createBezierLineString(start: number[], end: number[]): LineString {
    const bezierPoints = []
    const center = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2]
    const radius = distance(start, end) / 2

    const startAngle = Math.atan2(start[1] - center[1], start[0] - center[0])
    const endAngle = Math.atan2(end[1] - center[1], end[0] - center[0])

    // Define the control points for the Bezier curve
    const controlPoints = [
        center[0] + (1 / 2) * radius * Math.sin(startAngle + (1 / 2) * (endAngle - startAngle)),
        center[1] + (1 / 2) * radius * Math.cos(startAngle + (1 / 2) * (endAngle - startAngle)),
    ]

    // Calculate intermediate points along the curve using a Bezier curve
    bezierPoints.push(start)
    for (let t = 0; t <= 1; t += 0.1) {
        const point = [
            (1 - t) * (1 - t) * start[0] + 2 * t * (1 - t) * controlPoints[0] + t * t * end[0],
            (1 - t) * (1 - t) * start[1] + 2 * t * (1 - t) * controlPoints[1] + t * t * end[1],
        ]
        bezierPoints.push(point)
    }
    bezierPoints.push(end)
    return new LineString(bezierPoints)
}

function addAccessNetworkLayer(map: Map, selectedPath: Path, queryPoints: QueryPoint[]) {
    const style = new Style({
        stroke: new Stroke({
            // color: 'rgba(170,170,170,1)',
            color: '#275DAD',
            width: 4,
            lineDash: [1, 10],
            lineCap: 'round',
            lineJoin: 'round',
        }),
    })
    const layer = new VectorLayer({
        source: new VectorSource(),
    })
    layer.setStyle(style)
    for (let i = 0; i < selectedPath.snapped_waypoints.coordinates.length; i++) {
        const start = fromLonLat([queryPoints[i].coordinate.lng, queryPoints[i].coordinate.lat])
        const end = fromLonLat(selectedPath.snapped_waypoints.coordinates[i])
        layer.getSource()?.addFeature(new Feature(createBezierLineString(start, end)))
    }
    layer.set(accessNetworkLayerKey, true)
    layer.setZIndex(1)
    map.addLayer(layer)
}

function addSelectedPathsLayer(map: Map, selectedPath: Path, updateMoreFrequently: boolean) {
    const styleArray = [
        new Style({
            stroke: new Stroke({
                color: 'rgba(255,255,255,1)',
                width: 9,
            }),
        }),
        new Style({
            stroke: new Stroke({
                color: 'rgb(49,104,187)',
                width: 7,
            }),
        }),
    ]

    const layer = new VectorLayer({
        source: new VectorSource({
            features: [new Feature(new LineString(selectedPath.points.coordinates.map(c => fromLonLat(c))))],
        }),
        style: styleArray,
        updateWhileAnimating: updateMoreFrequently,
        updateWhileInteracting: updateMoreFrequently,
        opacity: 0.8,
        zIndex: 2,
    })

    layer.set(selectedPathLayerKey, true)
    map.addLayer(layer)
}

function removeSelectPathInteractions(map: Map) {
    map.getInteractions()
        .getArray()
        .filter(i => i.get('gh:select_path_interaction'))
        .forEach(i => map.removeInteraction(i))
}
