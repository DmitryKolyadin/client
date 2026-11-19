export type DocumentationVersion = {
    id: string;
    title: string;
    url: string;
};

export type VersionsRegistry = {
    schemaVersion: 1;
    latestStable: string | null;
    versions: DocumentationVersion[];
};

export const VERSION_FALLBACK_QUERY = '__diplodoc_version_fallback';

const VERSION_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;

export function versionFromLocation(location: URL) {
    const id = location.pathname.match(/^\/v\/([^/]+)\//)?.[1];
    return id && VERSION_ID.test(id) ? id : undefined;
}

export function parseVersionsRegistry(value: unknown): VersionsRegistry | null {
    if (!value || typeof value !== 'object') {
        return null;
    }

    const registry = value as Partial<VersionsRegistry>;
    if (registry.schemaVersion !== 1 || !Array.isArray(registry.versions)) {
        return null;
    }

    const ids = new Set<string>();
    for (const version of registry.versions) {
        if (
            !version ||
            typeof version.id !== 'string' ||
            !VERSION_ID.test(version.id) ||
            ids.has(version.id) ||
            typeof version.title !== 'string' ||
            !version.title.trim() ||
            version.url !== `/v/${version.id}/`
        ) {
            return null;
        }
        ids.add(version.id);
    }

    if (
        registry.latestStable !== null &&
        (typeof registry.latestStable !== 'string' || !ids.has(registry.latestStable))
    ) {
        return null;
    }

    return registry as VersionsRegistry;
}

type Probe = (url: URL) => Promise<Response>;

async function probePage(url: URL, version: DocumentationVersion, probe: Probe) {
    const result = await probe(url);
    const destination = new URL(result.url || url.href);
    if (destination.origin !== url.origin || !destination.pathname.startsWith(version.url)) {
        throw new Error('Unexpected documentation URL');
    }
    if (result.status === 404) {
        return null;
    }
    if (!result.ok || !/^text\/html\b/i.test(result.headers.get('content-type') ?? '')) {
        throw new Error('Documentation page could not be checked');
    }
    return destination;
}

export async function resolveVersionDestination(
    location: URL,
    current: DocumentationVersion,
    version: DocumentationVersion,
    lang: string,
    probe: Probe,
) {
    const path = location.pathname.slice(current.url.length);
    const target = new URL(version.url, location);
    const candidate = new URL(target);
    candidate.pathname += path;
    candidate.search = location.search;

    const article = await probePage(candidate, version, probe);
    if (article) {
        article.search = location.search;
        article.hash = location.hash;
        return article;
    }

    // A single-language build can have an unprefixed home even when lang is configured.
    const langHome = path.startsWith(`${lang}/`)
        ? await probePage(new URL(`${encodeURIComponent(lang)}/`, target), version, probe)
        : null;
    const fallback = langHome ?? (await probePage(target, version, probe));
    if (!fallback) {
        throw new Error('The selected documentation version has no home');
    }

    fallback.searchParams.set(VERSION_FALLBACK_QUERY, '1');
    return fallback;
}
