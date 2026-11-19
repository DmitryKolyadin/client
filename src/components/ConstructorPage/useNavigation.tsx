import type {ComponentType, ReactNode} from 'react';
import type {DocBasePageData, ViewerInterface} from '@diplodoc/components';
import type {WithNavigation} from '../App';
import type {Props as HeaderControlsProps} from '../HeaderControls';
import type {NavigationData, NavigationItemModel} from './navigationTypes';

import {useMemo} from 'react';
import {
    ControlSizes,
    CustomNavigation,
    MobileDropdown,
    NavigationDropdown,
    NavigationLabel,
} from '@diplodoc/components';

import {HEADER_HEIGHT} from '../../constants';
import {useRouter, useSearch} from '../';
import {VersionsSelect} from '../VersionsSelect';

function findItem(right: NavigationItemModel[], left: NavigationItemModel[], type: string) {
    return right.some((item) => item.type === type) || left.some((item) => item.type === type);
}

type NavigationDataWithOptionalLogo = Omit<NavigationData, 'logo'> & {
    logo?: NavigationData['logo'];
};

const EmptyNavigation = {} as NavigationData;
const EmptyHeader = {} as NavigationData['header'];
const EmptyLeftItems = [] as NavigationItemModel[];
const EmptyRightItems = [] as NavigationItemModel[];
const searchItem = {type: 'search'} as unknown as NavigationItemModel;
const versionsItem = {type: 'documentation-versions'} as unknown as NavigationItemModel;

export const useNavigation = (
    data: DocBasePageData<WithNavigation>,
    controls: HeaderControlsProps,
    CustomControls: ComponentType<{}>,
    CustomSuggest: () => ReactNode,
    withVersions: boolean,
    viewerInterface?: ViewerInterface,
): {
    custom: {
        search: typeof CustomSuggest;
        controls: typeof CustomControls;
        MobileDropdown: typeof MobileDropdown;
        label: typeof NavigationLabel;
        dropdown: typeof NavigationDropdown;
        'documentation-versions': typeof VersionsSelect;
    };
    layout?: {
        // PageConstructor gets an empty header; CustomNavigation renders the real items.
        header: {leftItems: never[]};
        renderNavigation: () => ReactNode;
        logo: NavigationData['logo'];
    };
    withControls: boolean;
} => {
    const {toc} = data;
    const navigation = toc.navigation || EmptyNavigation;
    const {header = EmptyHeader, logo} = navigation as NavigationDataWithOptionalLogo;
    const {
        leftItems = EmptyLeftItems,
        rightItems = EmptyRightItems,
        customMobileHeaderItems,
    } = header;

    const withControls = findItem(rightItems, leftItems, 'controls');
    const withSearch = findItem(rightItems, leftItems, 'search');

    const search = useSearch();
    const router = useRouter();

    const navigationData = useMemo(() => {
        const desktopItems = search && !withSearch ? [searchItem, ...rightItems] : rightItems;
        const mobileItems = customMobileHeaderItems ?? [searchItem];
        return {
            withBorder: true,
            leftItems,
            rightItems: withVersions ? [versionsItem, ...desktopItems] : desktopItems,
            customMobileHeaderItems: withVersions ? [versionsItem, ...mobileItems] : mobileItems,
        };
    }, [leftItems, rightItems, customMobileHeaderItems, search, withSearch, withVersions]);
    const navigationTocData = useMemo(
        () => ({
            toc,
            router,
            headerHeight: HEADER_HEIGHT,
        }),
        [toc, router],
    );
    const mobileControlsData = useMemo(
        () => ({
            controlSize: ControlSizes.L,
            userSettings: controls,
            viewerInterface,
        }),
        [controls, viewerInterface],
    );

    const layout = useMemo(
        () =>
            EmptyNavigation === navigation && !withVersions
                ? undefined
                : {
                      header: {
                          leftItems: [],
                      },
                      renderNavigation: () => (
                          <CustomNavigation
                              logo={{...logo, icon: logo?.icon ?? ''}}
                              data={navigationData}
                              navigationTocData={navigationTocData}
                              mobileControlsData={mobileControlsData}
                          />
                      ),
                      logo: {...logo, icon: logo?.icon ?? ''},
                  },
        [navigationData, navigationTocData, mobileControlsData, logo, navigation, withVersions],
    );

    const config = useMemo(
        () => ({
            custom: {
                search: CustomSuggest,
                controls: CustomControls,
                MobileDropdown: MobileDropdown,
                label: NavigationLabel,
                dropdown: NavigationDropdown,
                'documentation-versions': VersionsSelect,
            },
            layout,
            withControls,
        }),
        [CustomSuggest, CustomControls, layout, withControls],
    );

    return config;
};
