const assert = require('node:assert/strict');
const {test} = require('node:test');

const {
    VERSION_FALLBACK_QUERY,
    parseVersionsRegistry,
    resolveVersionDestination,
    versionFromLocation,
} = require('../src/components/VersionsSelect/versions.ts');

const origin = 'https://docs.example.test';
const latest = {id: '2.0.0', title: '2.0.0', url: '/v/2.0.0/'};
const older = {id: '1.0.0', title: '1.0.0', url: '/v/1.0.0/'};
const registry = {schemaVersion: 1, latestStable: latest.id, versions: [latest, older]};

function page(status, url) {
    return {status, ok: status === 200, url, headers: new Headers({'content-type': 'text/html'})};
}

test('reads current ID from the versioned path and validates the registry URLs', () => {
    assert.equal(versionFromLocation(new URL(`${origin}${older.url}ru/intro.html`)), older.id);
    assert.equal(versionFromLocation(new URL(`${origin}/ru/intro.html`)), undefined);
    assert.deepEqual(parseVersionsRegistry(registry), registry);
    assert.equal(parseVersionsRegistry({...registry, latestStable: 'missing'}), null);
    assert.equal(parseVersionsRegistry({...registry, versions: [latest, latest]}), null);
    assert.equal(
        parseVersionsRegistry({...registry, versions: [{...latest, url: '//example.org/'}]}),
        null,
    );
});

test('preserves article, locale, original query and hash with a same-version canonical redirect', async () => {
    const start = new URL(`${origin}${latest.url}ru/install/?foo=1&foo=a+b#note`);
    const result = await resolveVersionDestination(start, latest, older, 'ru', async (url) => {
        assert.equal(url.href, `${origin}${older.url}ru/install/?foo=1&foo=a+b`);
        return page(200, `${origin}${older.url}ru/install/index.html?foo=1&foo=a%20b`);
    });
    assert.equal(result.href, `${origin}${older.url}ru/install/index.html?foo=1&foo=a+b#note`);
});

test('uses the target locale home after a 404 or the version home if the locale is absent', async () => {
    const start = new URL(`${origin}${latest.url}ru/guide.html#note`);
    for (const localeExists of [true, false]) {
        const seen = [];
        const destination = await resolveVersionDestination(
            start,
            latest,
            older,
            'ru',
            async (url) => {
                seen.push(url.pathname);
                return page(
                    url.pathname === older.url || (localeExists && url.pathname.endsWith('/ru/'))
                        ? 200
                        : 404,
                );
            },
        );
        const expectedPath = `${older.url}${localeExists ? 'ru/' : ''}`;
        assert.equal(destination.pathname, expectedPath);
        assert.equal(destination.searchParams.get(VERSION_FALLBACK_QUERY), '1');
        assert.equal(destination.hash, '');
        assert.deepEqual(seen, [
            `${older.url}ru/guide.html`,
            `${older.url}ru/`,
            ...(localeExists ? [] : [older.url]),
        ]);
    }
});

test('does not fall back after a network error, another status, or a wrong-scope redirect', async () => {
    const start = new URL(`${origin}${latest.url}guide.html`);
    for (const check of [
        async () => {
            throw new TypeError('network error');
        },
        async () => page(503),
        async () => page(200, `${origin}${latest.url}`),
    ]) {
        const seen = [];
        await assert.rejects(
            resolveVersionDestination(start, latest, older, 'en', (url) => {
                seen.push(url.pathname);
                return check();
            }),
        );
        assert.deepEqual(seen, [`${older.url}guide.html`]);
    }
});
