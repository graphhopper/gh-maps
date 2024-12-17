import { useContext, useEffect, useRef, useState } from 'react'
import styles from '@/pathDetails/PathDetails.module.css'
import { HeightGraph } from 'heightgraph/src/heightgraph'
import '@/pathDetails/HeightGraph.css'
import { Path } from '@/api/graphhopper'
import Dispatcher from '@/stores/Dispatcher'
import { PathDetailsElevationSelected, PathDetailsHover, PathDetailsRangeSelected } from '@/actions/Actions'
import QueryStore, { Coordinate, QueryPointType } from '@/stores/QueryStore'
import { Position } from 'geojson'
import { calcDist } from '@/turnNavigation/GeoMethods'
import { tr } from '@/translation/Translation'
import { SettingsContext } from '@/contexts/SettingsContext'

interface PathDetailsProps {
    selectedPath: Path
}

export default function ({ selectedPath }: PathDetailsProps) {
    // keep a ref to the container to determine the size of the graph,
    const containerRef: React.RefObject<HTMLDivElement> = useRef(null)

    // keep a ref to the container of the actual graph and pass it to the graph once the container is mounted
    const heightgraphRef: React.RefObject<HTMLDivElement> = useRef(null)
    const [graph, setGraph] = useState<any | null>(null)
    useEffect(() => {
        const options = {
            width: clampWidth(containerRef.current!.clientWidth),
            height: 160,
            expandControls: true,
            // todo: add selected_detail url parameter
        }
        const callbacks = {
            pointSelectedCallback: onPathDetailHover,
            areaSelectedCallback: onRangeSelected,
            routeSegmentsSelectedCallback: onElevationSelected,
        }
        setGraph(new HeightGraph(heightgraphRef.current, options, callbacks))
    }, [heightgraphRef])

    // the graph needs to be resized when the window size changes and when the component mounts
    // because then the width will be 0 first and then a plausible value after the layout pass
    const resizeGraph = () => {
        graph?.resize({ width: clampWidth(containerRef.current!.clientWidth) })
    }
    useEffect(() => {
        window.addEventListener('resize', resizeGraph)
        return () => window.removeEventListener('resize', resizeGraph)
    })

    // set data in case anything changes
    useEffect(() => {
        const pathDetailsData = buildPathDetailsData(selectedPath)
        graph?.setData(pathDetailsData.data, pathDetailsData.mappings)
    }, [selectedPath, graph])

    const settings = useContext(SettingsContext)
    useEffect(() => {
        graph?.setImperial(settings.showDistanceInMiles)
        graph?.redraw()
    }, [graph, settings.showDistanceInMiles])

    // render the container
    const isPathPresent = selectedPath.points.coordinates.length !== 0
    const style: any = { display: isPathPresent ? null : 'none' }
    return (
        <div className={styles.heightgraphContainer} ref={containerRef}>
            <div className={styles.innerDiv} style={style} ref={heightgraphRef} />
        </div>
    )
}

function clampWidth(clientWidth: number) {
    return Math.min(clientWidth, 1000)
}

/** executed when we hover the mouse over the path details diagram */
function onPathDetailHover(point: Coordinate, elevation: number, description: string) {
    Dispatcher.dispatch(new PathDetailsHover(point ? { point, elevation, description } : null))
}

/** executed when we box-select a range of the path details diagram */
function onRangeSelected(bbox: { sw: Coordinate; ne: Coordinate } | null) {
    // bbox = null means that the range was cleared
    Dispatcher.dispatch(
        new PathDetailsRangeSelected(bbox ? [bbox.sw.lng, bbox.sw.lat, bbox.ne.lng, bbox.ne.lat] : null)
    )
}

/** executed when we use the vertical elevation slider on the right side of the diagram */
function onElevationSelected(segments: Coordinate[][]) {
    Dispatcher.dispatch(new PathDetailsElevationSelected(segments))
}

function buildPathDetailsData(selectedPath: Path) {
    // add zero elevation in case the path is 2D when points_encoded=false and no elevation data on the server side (?)
    const coordinates = selectedPath.points.coordinates.map((pos: Position) => (pos.length == 2 ? [...pos, 0] : pos))

    const result = {
        data: [] as any[],
        mappings: {} as any,
    }

    // elevation
    const elevation = createFeatureCollection(tr('elevation'), [createFeature(coordinates, 'elevation')])
    result.data.push(elevation)
    result.mappings[tr('elevation')] = function () {
        return { text: tr('elevation'), color: QueryStore.getMarkerColor(QueryPointType.From) }
    }

    // slope
    const slopeFeatures = []
    for (let i = 0; i < coordinates.length - 1; i++) {
        const from = coordinates[i]
        const to = coordinates[i + 1]
        const distance = calcDistLonLat(from, to)
        const slope = distance == 0 ? 0 : (100.0 * (to[2] - from[2])) / distance
        const slopeRounded = Math.round(slope / 3) * 3
        slopeFeatures.push(createFeature([from, to], slopeRounded))
    }
    const slopeCollection = createFeatureCollection(tr('slope'), slopeFeatures)
    result.data.push(slopeCollection)
    result.mappings[tr('slope')] = slope2color

    // tower slope: slope between tower nodes: use edge_id detail to find tower nodes
    if ((selectedPath.details as any)['edge_id']) {
        const detail = (selectedPath.details as any)['edge_id']
        const towerSlopeFeatures = []
        for (let i = 0; i < detail.length; i++) {
            const featurePoints = coordinates.slice(detail[i][0], detail[i][1] + 1)
            const from = featurePoints[0]
            const to = featurePoints[featurePoints.length - 1]
            const distance = calcDistLonLat(from, to)
            const slope = distance == 0 ? 0 : (100.0 * (to[2] - from[2])) / distance
            const slopeRounded = Math.round(slope / 3) * 3
            // for the elevations in tower slope diagram we do linear interpolation between the tower nodes. note that
            // we cannot simply leave out the pillar nodes, because otherwise the total distance would change
            let tmpDistance = 0
            for (let j = 0; j < featurePoints.length; j++) {
                const factor = tmpDistance / distance
                let ele = from[2] + factor * (to[2] - from[2])
                if (j === featurePoints.length - 1)
                    // there seem to be some small rounding errors which lead to ugly little spikes in the diagram,
                    // so for the last point use the elevation of the to point directly
                    ele = to[2]
                featurePoints[j] = [featurePoints[j][0], featurePoints[j][1], ele]
                if (j < featurePoints.length - 1) tmpDistance += calcDistLonLat(featurePoints[j], featurePoints[j + 1])
            }
            towerSlopeFeatures.push(createFeature(featurePoints, slopeRounded))
        }
        const towerSlopeCollection = createFeatureCollection(tr('towerslope'), towerSlopeFeatures)
        result.data.push(towerSlopeCollection)
        result.mappings[tr('towerslope')] = slope2color
    }

    // path details
    Object.entries(selectedPath.details).map(([detailName, details]) => {
        const features = details.map(([from, to, value = 'Undefined']: [number, number, string | number]) =>
            createFeature(coordinates.slice(from, to + 1), value)
        )
        result.data.push(createFeatureCollection(tr(detailName), features))
        result.mappings[tr(detailName)] = createColorMapping(details)
    })
    return result
}

function createColorMapping(detail: PathDetails): (attributeType: any) => { text: string; color: string } {
    const detailInfo: any = inspectDetail(detail)
    if (detailInfo.numeric === true && detailInfo.minVal !== detailInfo.maxVal) {
        // for numeric details we use a color gradient, taken from here:  https://uigradients.com/#Superman
        const colorMin = [0, 153, 247]
        const colorMax = [241, 23, 18]
        return function (attributeType: number) {
            const factor = (attributeType - detailInfo.minVal) / (detailInfo.maxVal - detailInfo.minVal)
            const color = []
            for (let i = 0; i < 3; i++) color.push(colorMin[i] + factor * (colorMax[i] - colorMin[i]))
            return {
                text: '' + attributeType,
                color: 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')',
            }
        }
    } else {
        // for discrete encoded values we use discrete colors
        const values = (detail as [number, number, string][]).map(d => d[2])
        return function (attributeType: string) {
            // we choose a color-blind friendly palette from here: https://personal.sron.nl/~pault/#sec:qualitative
            // see also this: https://thenode.biologists.com/data-visualization-with-flying-colors/research/
            const palette = [
                '#332288',
                '#88ccee',
                '#44aa99',
                '#117733',
                '#999933',
                '#ddcc77',
                '#cc6677',
                '#882255',
                '#aa4499',
            ]
            const missingColor = '#dddddd'
            const index = values.indexOf(attributeType) % palette.length
            const color =
                attributeType === 'missing' || attributeType === 'unclassified' || attributeType === 'Undefined'
                    ? missingColor
                    : palette[index]
            return {
                text: attributeType,
                color: color,
            }
        }
    }
}

function slope2color(slope: number): object {
    const colorMin = [0, 153, 247]
    const colorMax = [241, 23, 18]
    const absSlope = Math.min(25, Math.abs(slope))
    const factor = absSlope / 25
    const color = [0, 1, 2].map(i => colorMin[i] + factor * (colorMax[i] - colorMin[i]))
    return {
        text:
            slope < 0
                ? '↘ ' + (-slope - 3).toFixed(0) + '-' + (-slope).toFixed(0) + '%'
                : '↗ ' + slope.toFixed(0) + '-' + (slope + 3).toFixed(0) + '%',
        color: Number.isNaN(slope) ? 'red' : 'rgb(' + color[0] + ', ' + color[1] + ', ' + color[2] + ')',
    }
}

function inspectDetail(detail: PathDetails): {
    numeric: boolean
    minVal: number | undefined
    maxVal: number | undefined
} {
    // we check if all detail values are numeric
    const numbers = new Set()
    let minVal, maxVal
    let numberCount = 0
    for (let i = 0; i < detail.length; i++) {
        const val = detail[i][2]
        if (typeof val === 'number') {
            if (!minVal) minVal = val
            if (!maxVal) maxVal = val
            numbers.add(val)
            numberCount++
            minVal = Math.min(val, minVal)
            maxVal = Math.max(val, maxVal)
        }
    }
    return {
        numeric: numberCount === detail.length,
        minVal: minVal,
        maxVal: maxVal,
    }
}

function createFeature(coordinates: number[][], attributeType: number | string) {
    return {
        type: 'Feature',
        geometry: {
            type: 'LineString',
            coordinates: coordinates,
        },
        properties: {
            attributeType: attributeType,
        },
    }
}

function createFeatureCollection(detailName: string, features: any[]) {
    return {
        type: 'FeatureCollection',
        features: features,
        properties: {
            summary: detailName,
            records: features.length,
        },
    }
}

function calcDistLonLat(p: number[], q: number[]) {
    return calcDist({ lat: p[1], lng: p[0] }, { lat: q[1], lng: q[0] })
}

type PathDetails = [number, number, number][] | [number, number, string][]
