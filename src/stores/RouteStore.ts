import Store from '@/stores/Store'
import { Action } from '@/stores/Dispatcher'
import { ClearRoute, RouteRequestSuccess, SetPoint, SetSelectedPath, SetNavigationStart } from '@/actions/Actions'
import QueryStore, { RequestState } from '@/stores/QueryStore'
import CurrentLocationStore from '@/stores/CurrentLocationStore'
import { Path, RoutingArgs, RoutingResult } from '@/api/graphhopper'

export interface RouteStoreState {
    routingResult: RoutingResult
    selectedPath: Path
}

export default class RouteStore extends Store<RouteStoreState> {
    private static getEmptyPath(): Path {
        return {
            bbox: [0, 0, 0, 0],
            instructions: [],
            points: {
                coordinates: [],
                type: 'LineString',
            },
            points_encoded: false,
            snapped_waypoints: {
                type: 'LineString',
                coordinates: [],
            },
            ascend: 0,
            descend: 0,
            details: {
                max_speed: [],
                street_name: [],
                toll: [],
            },
            distance: 0,
            points_order: [],
            time: 0,
        }
    }

    private readonly queryStore: QueryStore
    private audioCtx : AudioContext
    private source?: AudioBufferSourceNode

    constructor(queryStore: QueryStore) {
        super()
        this.queryStore = queryStore

        window.AudioContext = window.AudioContext; // || window.webkitAudioContext;
        this.audioCtx = new AudioContext();
    }

    startNavigation(currentLocationStore: CurrentLocationStore) {
        synthesize("Willkommen")
        currentLocationStore.init();
    }

    synthesize(text: string) {
        // Instead of AudioContext we could use the simpler looking solution via HTMLMediaElement in combination with
        // element.src = URL.createObjectURL(request.response) but I'm unsure how to make it permanently active on mobile
        // (we could still connect AudioContext with an audio control)
        const url = 'http://157.90.156.93:5002/api/tts?text=' + encodeURIComponent(text);
        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';
        xhr.onload = () => {
          this.initSound(xhr.response);
        };
        xhr.send();
    }

    playSound(audioBuffer: any) {
        if(this.source)
            this.source.stop();
        this.source = this.audioCtx.createBufferSource();
        this.source.buffer = audioBuffer;
        this.source.loop = false;
        this.source.connect(this.audioCtx.destination);
        this.source.start();
    }

    async initSound(blob: any) {
        const arrayBuffer = await blob.arrayBuffer()
        this.audioCtx.decodeAudioData(arrayBuffer, (audioData: any) => {
            this.playSound(audioData)
        }, function(e: any) {
            console.log('Error decoding file', e);
        });
    }

    reduce(state: RouteStoreState, action: Action): RouteStoreState {
        if (action instanceof SetNavigationStart) {
            const instructions = state.selectedPath.instructions
            var closeIndex = -1
            var smallestDist = Number.MAX_VALUE
            var distanceNext = 10.0
            // find instruction nearby and very simple method (pick first point)
            for(var i = 0; i < instructions.length; i++) {
                const points: number[][] = instructions[i].points;
                const p: number[] = points[0]
                const dist = CurrentLocationStore.distCalc(p[1], p[0], action.coordinate.lat, action.coordinate.lng)
                if( dist < smallestDist) {
                    smallestDist = dist
                    closeIndex = i

                    const last: number[] = points[points.length - 1]
                    distanceNext = Math.round(CurrentLocationStore.distCalc(last[1], last[0], action.coordinate.lat, action.coordinate.lng))
                }
            }

            // TODO marker on map
            if(smallestDist < 500) {
                this.synthesize("In " + distanceNext + " Metern " + instructions[closeIndex].text)

            } else {
                this.synthesize("Vom Weeg abgekommen.")
            }

        } else if (action instanceof RouteRequestSuccess) {
            return this.reduceRouteReceived(state, action)
        } else if (action instanceof SetSelectedPath) {
            return {
                ...state,
                selectedPath: action.path,
            }
        } else if (action instanceof SetPoint || action instanceof ClearRoute) {
            return this.getInitialState()
        }
        return state
    }

    protected getInitialState(): RouteStoreState {
        return {
            routingResult: {
                paths: [],
                info: {
                    copyright: [],
                    took: 0,
                },
            },
            selectedPath: RouteStore.getEmptyPath(),
        }
    }

    private reduceRouteReceived(state: RouteStoreState, action: RouteRequestSuccess) {
        if (this.isStaleRequest(action.request)) return state

        if (RouteStore.containsPaths(action.result.paths)) {
            return {
                routingResult: action.result,
                selectedPath: action.result.paths[0],
            }
        }
        return this.getInitialState()
    }

    private isStaleRequest(request: RoutingArgs) {
        // this could be probably written less tedious...
        const subRequests = this.queryStore.state.currentRequest.subRequests
        let requestIndex = -1
        let mostRecentAndFinishedIndex = -1
        for (let i = 0; i < subRequests.length; i++) {
            const element = subRequests[i]
            if (element.args === request) {
                requestIndex = i
            }
            if (element.state === RequestState.SUCCESS) {
                mostRecentAndFinishedIndex = i
            }
        }

        return requestIndex < 0 && requestIndex < mostRecentAndFinishedIndex
    }

    private static containsPaths(paths: Path[]) {
        return paths.length > 0
    }
}
