import React from 'react'
import ReactDOM from 'react-dom'

import { setTranslation } from '@/translation/Translation'
import App from '@/App'
import {
    getApiInfoStore,
    getErrorStore,
    getMapOptionsStore,
    getPathDetailsStore,
    getQueryStore,
    getRouteStore,
    getViewportStore,
    setStores,
} from '@/stores/Stores'
import Dispatcher from '@/stores/Dispatcher'
import RouteStore from '@/stores/RouteStore'
import ApiInfoStore from '@/stores/ApiInfoStore'
import QueryStore from '@/stores/QueryStore'
import { ApiImpl } from '@/api/Api'
import ErrorStore from '@/stores/ErrorStore'
import MapOptionsStore from '@/stores/MapOptionsStore'
import PathDetailsStore from '@/stores/PathDetailsStore'
import ViewportStore from '@/stores/ViewportStore'
import NavBar from '@/NavBar'

setTranslation(navigator.language)

// set up state management
const api = new ApiImpl()
const queryStore = new QueryStore(api)
const routeStore = new RouteStore(queryStore)
const mapOptionsStore = new MapOptionsStore()

const smallScreenMediaQuery = window.matchMedia('(max-width: 44rem)')

setStores({
    queryStore: queryStore,
    routeStore: routeStore,
    infoStore: new ApiInfoStore(),
    errorStore: new ErrorStore(),
    mapOptionsStore: mapOptionsStore,
    pathDetailsStore: new PathDetailsStore(),
    viewportStore: new ViewportStore(routeStore, () => smallScreenMediaQuery.matches),
})

// register stores at dispatcher to receive actions
Dispatcher.register(getQueryStore())
Dispatcher.register(getRouteStore())
Dispatcher.register(getApiInfoStore())
Dispatcher.register(getErrorStore())
Dispatcher.register(getMapOptionsStore())
Dispatcher.register(getPathDetailsStore())
Dispatcher.register(getViewportStore())

mapOptionsStore.loadStyles() // load map styles immediately
api.infoWithDispatch() // get infos about the api as soon as possible

// hook up the navbar to the query store and vice versa
const navBar = new NavBar(getQueryStore(), window)
// parse the initial url
navBar.parseUrl()

// create a div which holds the app and render the 'App' component
const root = document.createElement('div') as HTMLDivElement
root.id = 'root'
root.style.height = '100%'
document.body.appendChild(root)

ReactDOM.render(<App />, root)
