// eslint-disable-next-line import/order
import './react-compat';

import type {DocAnalytics, DocInnerProps, DocLeadingPageData, DocPageData} from './components/App';

import {createRoot, hydrateRoot} from 'react-dom/client';

import {App} from './components/App';
import {preserveEmbedLinks} from './interceptors/embed-links';
import {setRootClasses} from './interceptors/fast-class-applier';
import {createAnalyticsProps} from './utils';

export type {DocInnerProps, DocPageData, DocLeadingPageData, DocAnalytics};
export type {
    SearchConfig as ISearchProviderConfig,
    WorkerConfig as ISearchWorkerConfig,
    WorkerApi as ISearchWorkerApi,
} from './components/Search';

const root = document.getElementById('root');
const data = window.__DATA__;

if (!root) {
    throw new Error('Root element not found!');
}

function isDocInnerProps(obj: unknown): obj is DocInnerProps {
    return Boolean(obj) && typeof obj === 'object' && obj !== null && 'data' in obj;
}

if (!isDocInnerProps(data)) {
    throw new Error('Invalid data format for App component');
}

const props = data as DocInnerProps;
const embed = new URLSearchParams(window.location.search).get('embed') === 'true';

if (window.STATIC_CONTENT && props.data.leading !== true) {
    const html = root.querySelector<HTMLElement>('[data-html-id="main"]')?.innerHTML;

    if (html !== undefined) {
        props.data.html = html;
    }
}

const {analyticsConfig, analyticsService} = createAnalyticsProps(props.analytics);

analyticsService.init();

setRootClasses(props);

if (embed) {
    preserveEmbedLinks(root, new URL('./', document.baseURI));
}

const app = (
    <App {...props} embed={embed} analytics={analyticsConfig} analyticsService={analyticsService} />
);

if (window.STATIC_CONTENT && !embed) {
    hydrateRoot(root, app);
} else {
    createRoot(root).render(app);
}
