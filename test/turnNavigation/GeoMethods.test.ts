import { calcOrientation, getCurrentInstruction, toNorthBased } from '../../src/turnNavigation/GeoMethods'
import Dispatcher from '../../src/stores/Dispatcher'
import { ApiImpl } from '../../src/api/Api'

let responseHoyerswerda1 = require('./response-hoyerswerda1.json')
let responseHoyerswerda2 = require('./response-hoyerswerda2.json')

afterEach(() => Dispatcher.clear())

describe('calculate instruction', () => {
    // http://localhost:3000/?point=51.437233%2C14.246489&point=51.435514%2C14.239923&profile=car
    it('second instruction should not be "right turn"', () => {
        let path = ApiImpl.decodeResult(responseHoyerswerda1, true)[0]
        const { index, distanceToTurn, timeToEnd, distanceToEnd } = getCurrentInstruction(
            path.instructions,
            {
                lat: 51.435029,
                lng: 14.243259,
            },
            undefined
        )

        expect(distanceToTurn).toEqual(236)
        expect(distanceToEnd).toEqual(236)
        expect(Math.round(timeToEnd / 1000)).toEqual(30)

        expect(path.instructions[index].text).toEqual('Ziel erreicht')
    })

    it('remaining time should be correct', () => {
        let path = ApiImpl.decodeResult(responseHoyerswerda1, true)[0]
        const { timeToEnd, distanceToEnd } = getCurrentInstruction(
            path.instructions,
            {
                lat: 51.439291,
                lng: 14.245254,
            },
            undefined
        )

        expect(Math.round(timeToEnd / 1000)).toEqual(101)
        expect(Math.round(distanceToEnd)).toEqual(578)
    })

    it('nextWaypointIndex should be correct', () => {
        let path = ApiImpl.decodeResult(responseHoyerswerda2, true)[0]
        {
            const { nextWaypointIndex } = getCurrentInstruction(
                path.instructions,
                {
                    lat: 51.434672,
                    lng: 14.267248,
                },
                undefined
            )
            expect(nextWaypointIndex).toEqual(1)
        }

        // points that could return both indices return the first
        // TODO include heading to differentiate!
        {
            const { nextWaypointIndex } = getCurrentInstruction(
                path.instructions,
                {
                    lat: 51.434491,
                    lng: 14.268535,
                },
                undefined
            )
            expect(nextWaypointIndex).toEqual(1)
        }

        {
            const { nextWaypointIndex } = getCurrentInstruction(
                path.instructions,
                {
                    lat: 51.433247,
                    lng: 14.267763,
                },
                undefined
            )
            expect(nextWaypointIndex).toEqual(2)
        }
    })

    it('pick instruction depending on heading for same location', () => {
        let path = ApiImpl.decodeResult(responseHoyerswerda2, true)[0]
        const location = { lat: 51.434356, lng: 14.267697 }
        {
            const { index } = getCurrentInstruction(path.instructions, location, 170)
            expect(path.instructions[index].text).toEqual('Turn left onto Franz-Liszt-Straße')
        }
        {
            const { index } = getCurrentInstruction(path.instructions, location, 240)
            expect(path.instructions[index].text).toEqual('Turn left onto Bautzener Allee')
        }
        {
            const { index } = getCurrentInstruction(path.instructions, location, 80)
            expect(path.instructions[index].text).toEqual('Waypoint 1')
        }
    })

    it('calc angle', () => {
        // downwards+west
        expect(Math.round(toDegrees(calcOrientation(51.439146, 14.245258, 51.438908, 14.245931)))).toEqual(-30)
        expect(
            Math.round(toDegrees(toNorthBased(calcOrientation(51.439146, 14.245258, 51.438908, 14.245931))))
        ).toEqual(120)
        // downwards
        expect(Math.round(toDegrees(calcOrientation(51.439146, 14.245258, 51.438748, 14.245255)))).toEqual(-90)
        expect(
            Math.round(toDegrees(toNorthBased(calcOrientation(51.439146, 14.245258, 51.438748, 14.245255))))
        ).toEqual(180)
        // down+west
        expect(Math.round(toDegrees(calcOrientation(51.439146, 14.245258, 51.439015, 14.244568)))).toEqual(-163)
        expect(
            Math.round(toDegrees(toNorthBased(calcOrientation(51.439146, 14.245258, 51.439015, 14.244568))))
        ).toEqual(253)
        // upward+west
        expect(Math.round(toDegrees(calcOrientation(51.439146, 14.245258, 51.43953, 14.244536)))).toEqual(140)
        expect(Math.round(toDegrees(toNorthBased(calcOrientation(51.439146, 14.245258, 51.43953, 14.244536))))).toEqual(
            310
        )
        // upward+east
        expect(Math.round(toDegrees(calcOrientation(51.439146, 14.245258, 51.439584, 14.24592)))).toEqual(47)
        expect(Math.round(toDegrees(toNorthBased(calcOrientation(51.439146, 14.245258, 51.439584, 14.24592))))).toEqual(
            43
        )
    })

    function toDegrees(radian: number) {
        return (radian / Math.PI) * 180.0
    }
})
