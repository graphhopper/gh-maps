import { AddressParseResult } from '@/pois/AddressParseResult'
import { getTranslation, setTranslation } from '@/translation/Translation'

beforeAll(() => {
    setTranslation('en', false)
    AddressParseResult.setPOITriggerPhrases(getTranslation())
})

describe('reverse geocoder', () => {
    it('should parse fully', async () => {
        let res = AddressParseResult.parse('dresden restaurant', false)
        expect(res.location).toEqual('dresden')
        expect(res.icon).toEqual('restaurant')

        res = AddressParseResult.parse('restaurant', false)
        expect(res.location).toEqual('')
        expect(res.icon).toEqual('restaurant')

        res = AddressParseResult.parse('restaurant in dresden', false)
        expect(res.location).toEqual('dresden')
        expect(res.icon).toEqual('restaurant')

        res = AddressParseResult.parse('airports around some thing else', false)
        expect(res.location).toEqual('some thing else')
        expect(res.icon).toEqual('flight_takeoff')

        res = AddressParseResult.parse('dresden super market', false)
        expect(res.location).toEqual('dresden')
        expect(res.poiType).toEqual('super markets')

        res = AddressParseResult.parse('dresden park', false)
        expect(res.location).toEqual('dresden')
        expect(res.poiType).toEqual('parks')

        res = AddressParseResult.parse('dresden parking', false)
        expect(res.location).toEqual('dresden')
        expect(res.poiType).toEqual('parking')

        res = AddressParseResult.parse('restaurants in this area', false)
        expect(res.location).toEqual('')
        expect(res.poiType).toEqual('restaurants')
    })

    it('should parse generic', async () => {
        let res = AddressParseResult.parse('dresden amenity=bar', false)
        expect(res.location).toEqual('dresden')
        expect(res.query.toString()).toEqual('amenity=bar')

        res = AddressParseResult.parse('dresden amenity=bar military!~.*', false)
        expect(res.location).toEqual('dresden')
        expect(res.query.toString()).toEqual('amenity=bar and military!~.*')

        res = AddressParseResult.parse('amenity=restaurant and wheelchair=yes in dresden', false)
        expect(res.location).toEqual('dresden')
        expect(res.query.toString()).toEqual('amenity=restaurant and wheelchair=yes')

        // no "select query", only 'not' queries => leads currently to no match
        res = AddressParseResult.parse('dresden amenity!=bar military!~.*', false)
        expect(res.hasPOIs()).toEqual(false)

        res = AddressParseResult.parse('sushi', false)
        expect(res.location).toEqual('')
        expect(res.query.toString()).toEqual('cuisine=sushi name~sushi')

        res = AddressParseResult.parse('Home improvement store', false)
        expect(res.location).toEqual('')
        expect(res.query.toString()).toEqual('shop=doityourself')

        // space should not confuse the parser
        res = AddressParseResult.parse('bike ', false)
        expect(res.hasPOIs()).toEqual(false)
    })
})
