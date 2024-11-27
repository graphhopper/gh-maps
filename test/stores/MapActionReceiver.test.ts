import MapActionReceiver from '@/stores/MapActionReceiver'
import { PathDetailsRangeSelected, RouteRequestSuccess, ZoomMapToPoint } from '@/actions/Actions'
import { createMap, getMap } from '@/map/map'

describe('MapActionReceiver', () => {
    it('should update camera position correctly', () => {
        const routeStore = {} as any
        createMap()
        const receiver = new MapActionReceiver(getMap(), routeStore, () => false)
        {
            // simply set to point
            receiver.receive(new ZoomMapToPoint({ lng: 13, lat: 48 }, 11))
            expect(getMap().getView().getCenter()![0]).toEqual(13)
            expect(getMap().getView().getCenter()![1]).toEqual(13)
            expect(getMap().getView().getZoom()).toEqual(13)
        }
        {
            // set to route ...
            const selectedPath = { bbox: [10.31, 50.73, 11.19, 51.31] }
            routeStore.state = { selectedPath }
            receiver.receive(
                new RouteRequestSuccess(
                    null as any,
                    {
                        paths: [selectedPath],
                    } as any
                )
            )
            expect(getMap().getView().getCenter()![0]).toBeCloseTo(10.5, 1)
            expect(getMap().getView().getCenter()![1]).toBeCloseTo(50.9, 1)
            expect(getMap().getView().getZoom()).toBeCloseTo(8.8, 1)
            // ... select path details
            receiver.receive(new PathDetailsRangeSelected([10.46, 50.88, 10.47, 50.9]))
            expect(getMap().getView().getCenter()![0]).toBeCloseTo(10.46, 2)
            expect(getMap().getView().getCenter()![1]).toBeCloseTo(50.89, 2)
            expect(getMap().getView().getZoom()).toBeCloseTo(13.7, 1)
            // ... deselect path details again -> we are back to the route bbox
            receiver.receive(new PathDetailsRangeSelected(null))
            expect(getMap().getView().getCenter()![0]).toBeCloseTo(10.5, 1)
            expect(getMap().getView().getCenter()![1]).toBeCloseTo(50.9, 1)
            expect(getMap().getView().getZoom()).toBeCloseTo(8.8, 1)
        }
    })
})
