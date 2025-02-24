import { PopoverPosition } from '@blueprintjs/core';
import { Dashboard, DashboardTileTypes } from '@lightdash/common';
import { Button, ButtonProps, Group, Menu, Text, Tooltip } from '@mantine/core';
import {
    IconChartBar,
    IconInfoCircle,
    IconMarkdown,
    IconPlus,
    IconVideo,
} from '@tabler/icons-react';
import { FC, useCallback, useState } from 'react';
import { useHistory, useParams } from 'react-router-dom';
import useDashboardStorage from '../../hooks/dashboard/useDashboardStorage';
import { useDashboardContext } from '../../providers/DashboardProvider';
import MantineIcon from '../common/MantineIcon';
import AddChartTilesModal from './TileForms/AddChartTilesModal';
import { TileAddModal } from './TileForms/TileAddModal';

type Props = {
    onAddTiles: (tiles: Dashboard['tiles'][number][]) => void;
    popoverPosition?: PopoverPosition;
} & Pick<ButtonProps, 'disabled'>;

const AddTileButton: FC<Props> = ({ onAddTiles, disabled }) => {
    const [addTileType, setAddTileType] = useState<DashboardTileTypes>();
    const [isAddChartTilesModalOpen, setIsAddChartTilesModalOpen] =
        useState<boolean>(false);

    const dashboardTiles = useDashboardContext((c) => c.dashboardTiles);
    const dashboardFilters = useDashboardContext((c) => c.dashboardFilters);
    const haveTilesChanged = useDashboardContext((c) => c.haveTilesChanged);
    const haveFiltersChanged = useDashboardContext((c) => c.haveFiltersChanged);
    const dashboard = useDashboardContext((c) => c.dashboard);

    const { storeDashboard } = useDashboardStorage();
    const history = useHistory();

    const onAddTile = useCallback(
        (tile: Dashboard['tiles'][number]) => {
            onAddTiles([tile]);
        },
        [onAddTiles],
    );
    const { projectUuid } = useParams<{
        projectUuid: string;
    }>();

    return (
        <>
            <Menu
                position="bottom"
                withArrow
                withinPortal
                shadow="md"
                width={200}
            >
                <Menu.Target>
                    <Button
                        size="xs"
                        variant="default"
                        disabled={disabled}
                        leftIcon={<MantineIcon icon={IconPlus} />}
                    >
                        Add tile
                    </Button>
                </Menu.Target>
                <Menu.Dropdown>
                    <Menu.Item
                        onClick={() => setIsAddChartTilesModalOpen(true)}
                        icon={<MantineIcon icon={IconChartBar} />}
                    >
                        Saved chart
                    </Menu.Item>

                    <Menu.Item
                        onClick={() => {
                            storeDashboard(
                                dashboardTiles,
                                dashboardFilters,
                                haveTilesChanged,
                                haveFiltersChanged,
                                dashboard?.uuid,
                                dashboard?.name,
                            );
                            history.push(`/projects/${projectUuid}/tables`);
                        }}
                        icon={<MantineIcon icon={IconPlus} />}
                    >
                        <Group spacing="xxs">
                            <Text>New chart</Text>
                            <Tooltip label="Charts generated from here are exclusive to this dashboard">
                                <MantineIcon
                                    icon={IconInfoCircle}
                                    color="gray.6"
                                />
                            </Tooltip>
                        </Group>
                    </Menu.Item>

                    <Menu.Item
                        onClick={() =>
                            setAddTileType(DashboardTileTypes.MARKDOWN)
                        }
                        icon={<MantineIcon icon={IconMarkdown} />}
                    >
                        Markdown
                    </Menu.Item>

                    <Menu.Item
                        onClick={() => setAddTileType(DashboardTileTypes.LOOM)}
                        icon={<MantineIcon icon={IconVideo} />}
                    >
                        Loom video
                    </Menu.Item>
                </Menu.Dropdown>
            </Menu>

            {isAddChartTilesModalOpen && (
                <AddChartTilesModal
                    onClose={() => setIsAddChartTilesModalOpen(false)}
                    onAddTiles={onAddTiles}
                />
            )}

            <TileAddModal
                isOpen={!!addTileType}
                type={addTileType}
                onClose={() => setAddTileType(undefined)}
                onConfirm={(tile) => {
                    onAddTile(tile);
                    setAddTileType(undefined);
                }}
            />
        </>
    );
};

export default AddTileButton;
