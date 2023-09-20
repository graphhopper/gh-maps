import { Feature, Map } from 'ol'
import { Path } from '@/api/graphhopper'
import { FeatureCollection } from 'geojson'
import { useEffect } from 'react'
import VectorLayer from 'ol/layer/Vector'
import VectorSource from 'ol/source/Vector'
import { GeoJSON } from 'ol/format'
import { Stroke, Style } from 'ol/style'
import { fromLonLat } from 'ol/proj'
import { Draw, Select } from 'ol/interaction'
import { click, primaryAction } from 'ol/events/condition'
import Dispatcher from '@/stores/Dispatcher'
import { SetQueryPoints, SetSelectedPath } from '@/actions/Actions'
import { SelectEvent } from 'ol/interaction/Select'
import { QueryPoint, QueryPointType } from '@/stores/QueryStore'
import LineString from 'ol/geom/LineString'
import { calcDist } from '@/distUtils'
import { Coordinate, distance } from 'ol/coordinate'

const pathsLayerKey = 'pathsLayer'
const selectedPathLayerKey = 'selectedPathLayer'
const accessNetworkLayerKey = 'accessNetworkLayer'
const handDrawQueryPointsLayerKey = 'handDrawQueryPointsLayer'

export default function usePathsLayer(map: Map, paths: Path[], selectedPath: Path, queryPoints: QueryPoint[]) {
    useEffect(() => {
        removeHandDrawQueryPointsLayers(map)
        addHandDrawQueryPointLayer(map)

        removeCurrentPathLayers(map)
        addUnselectedPathsLayer(
            map,
            paths.filter(p => p != selectedPath)
        )
        addSelectedPathsLayer(map, selectedPath)
        addAccessNetworkLayer(map, selectedPath, queryPoints)
        return () => {
            removeCurrentPathLayers(map)
            removeHandDrawQueryPointsLayers(map)
        }
    }, [map, paths, selectedPath])
}

function removeCurrentPathLayers(map: Map) {
    map.getLayers()
        .getArray()
        .filter(l => l.get(pathsLayerKey) || l.get(selectedPathLayerKey) || l.get(accessNetworkLayerKey))
        .forEach(l => map.removeLayer(l))
}

function removeHandDrawQueryPointsLayers(map: Map) {
    map.getLayers()
        .getArray()
        .filter(l => l.get(handDrawQueryPointsLayerKey))
        .forEach(l => map.removeLayer(l))
}

function addHandDrawQueryPointLayer(map: Map) {
    const source = new VectorSource()

    // TODO NOW cache style

    // hide line as we draw route and markers
    const style = new Style({
        // geometry: function (feature) {
        //     const modifyGeometry = feature.get('modifyGeometry');
        //     return modifyGeometry ? modifyGeometry.geometry : feature.getGeometry();
        // },
        // fill: new Fill({
        //     color: 'rgba(255, 255, 255, 0.2)',
        // }),
        // stroke: new Stroke({
        //     color: '#7fa6e0',
        //     width: 3,
        // }),
        // image: new CircleStyle({
        //     radius: 7,
        //     fill: new Fill({
        //         color: '#ff4b33',
        //     }),
        // }),
    })

    const vectorLayer = new VectorLayer({
        source: source,
        style: function (feature) {
            return [style]
        },
    })

    map.addLayer(vectorLayer)

    const draw = new Draw({
        condition: event => {
            return primaryAction(event)
        },

        // we handle this later
        // maxPoints: 200,

        /* TODO how to move the map? */
        // freehand: false,
        source: source,
        type: 'LineString',
    })

    draw.on('drawend', e => {
        if (!e.feature) return

        const geometry = e.feature.getGeometry()?.transform('EPSG:3857', 'EPSG:4326')

        if (geometry instanceof LineString) {
            const coords = geometry.getCoordinates().map((c: Coordinate, idx: number) => {
                return {
                    lat: Math.round(c[1] * 1_000_000) / 1_000_000,
                    lng: Math.round(c[0] * 1_000_000) / 1_000_000,
                }
            })
            let resultCoords = []
            let prevCoord = coords[0]
            let prevIdx = 0
            let zoom = map.getView().getZoom()
            // not sure how to do this with coords.filter
            for (let idx = 1; idx < coords.length; idx++) {

                // TODO NOW find a better way!?
                // Now skip certain locations depending on the distance (which is zoom-dependent)
                if (calcDist(prevCoord, coords[idx]) > 6000 / (zoom ? zoom : 10)) {
                    resultCoords.push(coords[idx])
                    prevCoord = coords[idx]
                    prevIdx = idx
                }
            }

            // API does not handle too many points
            resultCoords = resultCoords.slice(0, 50)
            const points = resultCoords.map((c, idx) => {
                return {
                    coordinate: c,
                    isInitialized: true,
                    id: idx, // TODO NOW this is not correct
                    queryText: '' + idx,
                    color: '',
                    type: QueryPointType.Via,
                }
            })
            Dispatcher.dispatch(new SetQueryPoints(points))
        } else {
            console.warn('not a LineString')
        }
        return false
    })

    map.addInteraction(draw)
}

function addUnselectedPathsLayer(map: Map, paths: Path[]) {
    const style = new Style({
        stroke: new Stroke({
            color: '#5B616A',
            width: 5,
            lineCap: 'round',
            lineJoin: 'round',
        }),
    })
    const layer = new VectorLayer({
        source: new VectorSource({
            features: new GeoJSON().readFeatures(createUnselectedPaths(paths)),
        }),
        style: () => style,
        opacity: 0.8,
    })
    layer.set(pathsLayerKey, true)
    layer.setZIndex(1)
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

function addSelectedPathsLayer(map: Map, selectedPath: Path) {
    const style = new Style({
        stroke: new Stroke({
            color: '#275DAD',
            width: 6,
            lineCap: 'round',
            lineJoin: 'round',
        }),
    })
    const layer = new VectorLayer({
        source: new VectorSource({
            features: new GeoJSON().readFeatures(createSelectedPath(selectedPath)),
        }),
        style: () => style,
        opacity: 0.8,
    })
    layer.set(selectedPathLayerKey, true)
    layer.setZIndex(2)
    map.addLayer(layer)
}

function createUnselectedPaths(paths: Path[]) {
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: paths.map((path, index) => {
            return {
                type: 'Feature',
                properties: {
                    index,
                },
                geometry: {
                    ...path.points,
                    coordinates: path.points.coordinates.map(c => fromLonLat(c)),
                },
            }
        }),
    }
    return featureCollection
}

function createSelectedPath(path: Path) {
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: {
                    ...path.points,
                    coordinates: path.points.coordinates.map(c => fromLonLat(c)),
                },
            },
        ],
    }
    return featureCollection
}

function removeSelectPathInteractions(map: Map) {
    map.getInteractions()
        .getArray()
        .filter(i => i.get('gh:select_path_interaction'))
        .forEach(i => map.removeInteraction(i))
}
