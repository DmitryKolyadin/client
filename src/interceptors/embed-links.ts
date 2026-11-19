export function preserveEmbedLinks(root: HTMLElement, docsBase: URL) {
    const preserveEmbed = (event: MouseEvent) => {
        const link = event.target instanceof Element ? event.target.closest('a[href]') : null;

        if (!(link instanceof HTMLAnchorElement) || link.hasAttribute('download')) {
            return;
        }

        const href = link.getAttribute('href')?.trim();
        if (!href) {
            return;
        }

        if (href.startsWith('#')) {
            link.href = new URL(href, window.location.href).href;
            return;
        }

        let url: URL;
        try {
            url = new URL(link.href);
        } catch {
            return;
        }

        if (
            url.protocol !== docsBase.protocol ||
            url.origin !== docsBase.origin ||
            !url.pathname.startsWith(docsBase.pathname) ||
            /\.(?!html?$)[^/]+$/i.test(url.pathname) ||
            url.searchParams.has('embed')
        ) {
            return;
        }

        url.searchParams.set('embed', 'true');
        link.href = url.href;
    };

    root.addEventListener('click', preserveEmbed, true);
    root.addEventListener('auxclick', preserveEmbed, true);
}
