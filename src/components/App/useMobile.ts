import {useSyncExternalStore} from 'react';

import {getMobileView} from '../../utils';

function subscribe(onResize: () => void) {
    window.addEventListener('resize', onResize);

    return () => window.removeEventListener('resize', onResize);
}

function getServerMobileView() {
    return false;
}

export function useMobile() {
    return useSyncExternalStore(subscribe, getMobileView, getServerMobileView);
}
