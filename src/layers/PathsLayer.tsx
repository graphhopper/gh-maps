import { Path } from '@/api/graphhopper'
import { FeatureCollection, LineString } from 'geojson'
import { Layer, Source } from 'react-map-gl'
import React from 'react'
import Dispatcher from '@/stores/Dispatcher'
import { SetSelectedPath } from '@/actions/Actions'
import { MapLayer } from '@/layers/MapLayer'

const pathsLayerKey = 'pathsLayer'
const selectedPathLayerKey = 'selectedPathLayer'

export default function (selectedPath: Path, paths: Path[], firstSymbolLayerId: string | undefined): MapLayer {
    const currentPaths = paths
        .map((path, i) => {
            return {
                path,
                index: i,
            }
        })
        .filter(indexPath => indexPath.path !== selectedPath)
    return {
        interactiveLayerIds: currentPaths.length === 0 ? [] : [pathsLayerKey],
        onClick: (feature: any) => {
            // select an alternative path if clicked
            if (feature.layer.id === pathsLayerKey) {
                const index = feature.properties!.index
                const path = currentPaths.find(indexPath => indexPath.index === index)
                Dispatcher.dispatch(new SetSelectedPath(path!.path))
            }
        },
        layer: (
            <>
                {createUnselectedPaths(currentPaths, firstSymbolLayerId)}
                {createSelectedPath(selectedPath, firstSymbolLayerId)}
            </>
        ),
    }
}

function createSelectedPath(path: Path, firstSymbolLayerId: string | undefined) {
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: [
            {
                type: 'Feature',
                properties: {},
                geometry: path.points as LineString,
            },
        ],
    }
    return (
        <Source type={'geojson'} data={featureCollection}>
            <Layer
                id={selectedPathLayerKey}
                type={'line'}
                layout={{
                    'line-join': 'round',
                    'line-cap': 'round',
                }}
                paint={{
                    'line-color': '#275DAD',
                    'line-width': 8,
                }}
                beforeId={firstSymbolLayerId}
            />
        </Source>
    )
}

function createUnselectedPaths(indexPaths: { path: Path; index: number }[], firstSymbolLayerId: string | undefined) {
    const featureCollection: FeatureCollection = {
        type: 'FeatureCollection',
        features: indexPaths.map(indexPath => {
            return {
                type: 'Feature',
                properties: {
                    index: indexPath.index,
                },
                geometry: indexPath.path.points as LineString,
            }
        }),
    }
    return (
        <Source type={'geojson'} data={featureCollection}>
            <Layer
                id={pathsLayerKey}
                type={'line'}
                layout={{
                    'line-join': 'round',
                    'line-cap': 'round',
                }}
                paint={{
                    'line-color': '#5B616A',
                    'line-width': 6,
                    'line-opacity': 0.8,
                }}
                beforeId={firstSymbolLayerId}
            />
        </Source>
    )
}
