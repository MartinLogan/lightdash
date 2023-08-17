import { Popover2Props } from '@blueprintjs/popover2';
import {
    DashboardFilterRule,
    DashboardTile,
    fieldId as getFieldId,
    FilterableField,
    isDashboardChartTileType,
    matchFieldByType,
    matchFieldByTypeAndName,
    matchFieldExact,
} from '@lightdash/common';
import {
    Box,
    Checkbox,
    Flex,
    Stack,
    Text,
    useMantineTheme,
} from '@mantine/core';
import { FC, useCallback, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { FilterActions } from '.';
import { useChartSummaries } from '../../../hooks/useChartSummaries';
import FieldAutoComplete from '../../common/Filters/FieldAutoComplete';
import MantineIcon from '../../common/MantineIcon';
import { getChartIcon } from '../../common/ResourceIcon';

type Props = {
    tiles: DashboardTile[];
    availableTileFilters: Record<string, FilterableField[] | undefined>;
    field: FilterableField;
    filterRule: DashboardFilterRule;
    popoverProps?: Popover2Props;
    onChange: (
        action: FilterActions,
        tileUuid: string,
        filter?: FilterableField,
    ) => void;
    onToggleAll: (checked: boolean) => void;
};

const TileFilterConfiguration: FC<Props> = ({
    tiles,
    field,
    filterRule,
    availableTileFilters,
    popoverProps,
    onChange,
    onToggleAll,
}) => {
    const theme = useMantineTheme();
    const { projectUuid } = useParams<{ projectUuid: string }>();

    const { data: savedCharts } = useChartSummaries(projectUuid, {
        refetchOnMount: false,
    });

    const sortTilesByFieldMatch = useCallback(
        (
            fieldMatcher: (
                a: FilterableField,
            ) => (b: FilterableField) => boolean,
            a: FilterableField[] | undefined,
            b: FilterableField[] | undefined,
        ) => {
            if (!a || !b) return 0;

            const matchA = a.some(fieldMatcher(field));
            const matchB = b.some(fieldMatcher(field));
            return matchA === matchB ? 0 : matchA ? -1 : 1;
        },
        [field],
    );

    const sortFieldsByMatch = useCallback(
        (
            fieldMatcher: (
                a: FilterableField,
            ) => (b: FilterableField) => boolean,
            a: FilterableField,
            b: FilterableField,
        ) => {
            const matchA = fieldMatcher(field)(a);
            const matchB = fieldMatcher(field)(b);
            return matchA === matchB ? 0 : matchA ? -1 : 1;
        },
        [field],
    );

    const sortedTileWithFilters = useMemo(() => {
        return Object.entries(availableTileFilters)
            .sort(([, a], [, b]) =>
                sortTilesByFieldMatch(matchFieldByTypeAndName, a, b),
            )
            .sort(([, a], [, b]) =>
                sortTilesByFieldMatch(matchFieldExact, a, b),
            );
    }, [sortTilesByFieldMatch, availableTileFilters]);

    const tileTargetList = useMemo(() => {
        return sortedTileWithFilters.map(([tileUuid, filters], index) => {
            const tile = tiles.find((t) => t.uuid === tileUuid);
            const tileConfig = filterRule.tileTargets?.[tileUuid];

            const isFilterAvailable =
                filters?.some(matchFieldByType(field)) ?? false;

            const sortedFilters = filters
                ?.filter(matchFieldByType(field))
                .sort((a, b) =>
                    sortFieldsByMatch(matchFieldByTypeAndName, a, b),
                )
                .sort((a, b) => sortFieldsByMatch(matchFieldExact, a, b));

            const fieldId = tileConfig?.fieldId;
            const selectedFilter = filters?.find(
                (f) => getFieldId(f) === fieldId,
            );

            const tileWithoutTitle =
                !tile?.properties.title || tile.properties.title.length === 0;
            const isChartTileType = tile && isDashboardChartTileType(tile);

            let tileLabel = '';
            if (tile) {
                if (tileWithoutTitle && isChartTileType) {
                    const relatedChart = savedCharts?.find(
                        (chart) =>
                            chart.uuid === tile.properties.savedChartUuid,
                    );
                    tileLabel = relatedChart?.name || '';
                } else if (tile.properties.title) {
                    tileLabel = tile.properties.title;
                }
            }

            return {
                key: tileUuid + index,
                label: tileLabel,
                checked: isFilterAvailable && !!tileConfig,
                tileUuid,
                ...(tile &&
                    isDashboardChartTileType(tile) && {
                        tileChartKind:
                            tile.properties.lastVersionChartKind ?? undefined,
                    }),
                sortedFilters,
                selectedFilter,
            };
        });
    }, [
        filterRule,
        field,
        savedCharts,
        sortFieldsByMatch,
        sortedTileWithFilters,
        tiles,
    ]);

    const isAllChecked = tileTargetList.every(({ checked }) => checked);
    const isIndeterminate =
        !isAllChecked && tileTargetList.some(({ checked }) => checked);

    return (
        <Stack spacing="lg">
            <Checkbox
                size="xs"
                checked={isAllChecked}
                indeterminate={isIndeterminate}
                label={
                    <Text fw={500}>
                        Select all{' '}
                        {isIndeterminate
                            ? ` (${
                                  tileTargetList.filter((v) => v.checked).length
                              } charts selected)`
                            : ''}
                    </Text>
                }
                styles={{
                    label: {
                        paddingLeft: theme.spacing.xs,
                    },
                }}
                onChange={() => {
                    if (isIndeterminate) {
                        onToggleAll(false);
                    } else {
                        onToggleAll(!isAllChecked);
                    }
                }}
            />
            <Stack spacing="md">
                {tileTargetList.map((value) => (
                    <Box key={value.key}>
                        <Checkbox
                            size="xs"
                            fw={500}
                            label={
                                <Flex align="center" gap="xxs">
                                    <MantineIcon
                                        color="blue.8"
                                        icon={getChartIcon(value.tileChartKind)}
                                    />
                                    {value.label}
                                </Flex>
                            }
                            styles={{
                                label: {
                                    paddingLeft: theme.spacing.xs,
                                },
                            }}
                            checked={value.checked}
                            onChange={(event) => {
                                onChange(
                                    event.currentTarget.checked
                                        ? FilterActions.ADD
                                        : FilterActions.REMOVE,
                                    value.tileUuid,
                                );
                            }}
                        />

                        {value.sortedFilters && (
                            <Box
                                ml="xl"
                                mt="sm"
                                display={!value.checked ? 'none' : 'auto'}
                            >
                                <FieldAutoComplete
                                    disabled={!value.checked}
                                    popoverProps={{
                                        lazy: true,
                                        minimal: true,
                                        matchTargetWidth: true,
                                        ...popoverProps,
                                    }}
                                    inputProps={{
                                        // TODO: Remove once this component is migrated to Mantine
                                        style: {
                                            borderRadius: '4px',
                                            borderWidth: '1px',
                                            boxShadow: 'none',
                                            fontSize: theme.fontSizes.xs,
                                        },
                                    }}
                                    fields={value.sortedFilters}
                                    activeField={value.selectedFilter}
                                    onChange={(newFilter) => {
                                        onChange(
                                            FilterActions.ADD,
                                            value.tileUuid,
                                            newFilter,
                                        );
                                    }}
                                />
                            </Box>
                        )}
                    </Box>
                ))}
            </Stack>
        </Stack>
    );
};

export default TileFilterConfiguration;
