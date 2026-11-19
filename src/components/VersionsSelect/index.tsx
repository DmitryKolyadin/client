import type {PropsWithChildren} from 'react';
import type {VersionsRegistry} from './versions';

import {createContext, useContext, useEffect, useRef, useState} from 'react';
import {Select, Toaster, ToasterComponent, ToasterProvider} from '@gravity-ui/uikit';
import {NavigationLayout} from '@gravity-ui/page-constructor';

import {
    VERSION_FALLBACK_QUERY,
    parseVersionsRegistry,
    resolveVersionDestination,
    versionFromLocation,
} from './versions';

const messages = {
    en: {
        label: 'Documentation version',
        fallback: 'This page is unavailable in the selected version. You are on its home page.',
        error: 'Could not switch documentation versions',
        retry: 'Retry',
    },
    ru: {
        label: 'Версия документации',
        fallback: 'В выбранной версии этой страницы нет. Открыта главная страница версии.',
        error: 'Не удалось переключить версию документации',
        retry: 'Повторить',
    },
};

export function useDocumentationVersions(embed: boolean, lang: string) {
    const [registry, setRegistry] = useState<VersionsRegistry | null>(null);
    const [currentId, setCurrentId] = useState<string>();
    const [loading, setLoading] = useState(false);
    const switching = useRef(false);
    const [toaster] = useState(() => new Toaster());
    const text = lang === 'ru' ? messages.ru : messages.en;

    useEffect(() => {
        if (embed) {
            return undefined;
        }

        const location = new URL(window.location.href);
        const id = versionFromLocation(location);
        if (!id) {
            return undefined;
        }
        setCurrentId(id);

        let request: AbortController | undefined;
        let lastRefreshAt = -Infinity;
        const refresh = () => {
            const now = performance.now();
            // A tab activation can fire both focus and visibilitychange.
            if (document.visibilityState !== 'visible' || request || now - lastRefreshAt < 500) {
                return;
            }
            lastRefreshAt = now;
            const controller = new AbortController();
            request = controller;
            const timeout = window.setTimeout(() => controller.abort(), 10000);

            fetch('/versions.json', {cache: 'no-store', signal: controller.signal})
                .then((response) => (response.ok ? response.json() : null))
                .then((value) => {
                    if (!controller.signal.aborted) {
                        const parsed = parseVersionsRegistry(value);
                        if (parsed) {
                            setRegistry(parsed);
                        }
                    }
                })
                .catch(() => {
                    // An unavailable registry must not replace the last valid choices.
                })
                .finally(() => {
                    window.clearTimeout(timeout);
                    request = undefined;
                });
        };

        refresh();
        window.addEventListener('focus', refresh);
        document.addEventListener('visibilitychange', refresh);
        return () => {
            request?.abort();
            window.removeEventListener('focus', refresh);
            document.removeEventListener('visibilitychange', refresh);
        };
    }, [embed]);

    useEffect(() => {
        const location = new URL(window.location.href);
        if (
            !embed &&
            versionFromLocation(location) &&
            location.searchParams.get(VERSION_FALLBACK_QUERY) === '1'
        ) {
            location.searchParams.delete(VERSION_FALLBACK_QUERY);
            window.history.replaceState(window.history.state, '', location);
            toaster.add({name: 'documentation-version-fallback', title: text.fallback});
        }
    }, [embed, text, toaster]);

    const current = embed
        ? undefined
        : registry?.versions.find((version) => version.id === currentId);

    async function switchVersion(id: string) {
        const version = registry?.versions.find((entry) => entry.id === id);
        if (!current || !version || id === current.id || switching.current) {
            return;
        }

        switching.current = true;
        setLoading(true);
        const toastName = 'documentation-version-error';
        toaster.remove(toastName);
        const controller = new AbortController();
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
            const destination = await resolveVersionDestination(
                new URL(window.location.href),
                current,
                version,
                lang,
                (url) => fetch(url, {method: 'HEAD', cache: 'no-store', signal: controller.signal}),
            );
            window.location.assign(destination);
        } catch {
            toaster.add({
                name: toastName,
                title: text.error,
                theme: 'danger',
                autoHiding: false,
                actions: [{label: text.retry, onClick: () => switchVersion(id)}],
            });
        } finally {
            window.clearTimeout(timeout);
            switching.current = false;
            setLoading(false);
        }
    }

    return {
        current,
        versions: registry?.versions,
        loading,
        switchVersion,
        toaster,
        label: text.label,
    };
}

type VersionState = ReturnType<typeof useDocumentationVersions>;
const VersionsContext = createContext<VersionState | null>(null);

export function VersionsProvider({
    children,
    state,
    mobile,
}: PropsWithChildren<{state: VersionState; mobile: boolean}>) {
    return (
        <VersionsContext.Provider value={state}>
            <ToasterProvider toaster={state.toaster}>
                {children}
                <ToasterComponent mobile={mobile} />
            </ToasterProvider>
        </VersionsContext.Provider>
    );
}

export function VersionsSelect({menuLayout}: {menuLayout?: NavigationLayout}) {
    const state = useContext(VersionsContext);
    if (menuLayout === NavigationLayout.Mobile || !state?.current || !state.versions) {
        return null;
    }

    const {current, versions, loading, switchVersion, label} = state;
    const mobile = menuLayout === NavigationLayout.Dropdown;
    return (
        <Select
            qa="documentation-version-select"
            aria-label={label}
            title={current.title}
            size={mobile ? 'l' : 'm'}
            width={mobile ? 86 : 108}
            popupWidth={232}
            value={[current.id]}
            options={versions.map(({id, title}) => ({value: id, content: title}))}
            loading={loading}
            onUpdate={([id]) => switchVersion(id)}
        />
    );
}
