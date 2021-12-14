import Store from "@/stores/Store";
import {Action} from "@/stores/Dispatcher";
import {TurnNavigationUpdate} from "@/actions/Actions";

export interface TurnNavigationState {
    fakeGPS: boolean
    acceptedRisk: boolean
    soundEnabled: boolean
}

export default class TurnNavigationStore extends Store<TurnNavigationState> {

    constructor() {
        super()
    }

    protected getInitialState(): TurnNavigationState {
        return {
            fakeGPS: false,
            acceptedRisk: false,
            soundEnabled: true,
        }
    }

    reduce(state: TurnNavigationState, action: Action): TurnNavigationState {
        if (action instanceof TurnNavigationUpdate)
            return {...action.update}
        return state
    }

}