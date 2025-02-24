import {
    Button as BlueprintButton,
    Divider,
    FormGroup,
    HTMLSelect,
    Intent,
} from '@blueprintjs/core';
import { subject } from '@casl/ability';
import {
    ApiScheduledDownloadCsv,
    assertUnreachable,
    ChartType,
    getCustomLabelsFromColumnProperties,
} from '@lightdash/common';
import EChartsReact from 'echarts-for-react';
import JsPDF from 'jspdf';
import React, { memo, RefObject, useCallback, useState } from 'react';

import { Button, Popover } from '@mantine/core';
import { IconShare2 } from '@tabler/icons-react';
import useEcharts from '../hooks/echarts/useEcharts';
import { useApp } from '../providers/AppProvider';
import { Can } from './common/Authorization';
import {
    COLLAPSABLE_CARD_BUTTON_PROPS,
    COLLAPSABLE_CARD_POPOVER_PROPS,
} from './common/CollapsableCard';
import MantineIcon from './common/MantineIcon';
import ExportSelector from './ExportSelector';
import { useVisualizationContext } from './LightdashVisualization/VisualizationProvider';

const FILE_NAME = 'lightdash_chart';

enum DownloadType {
    JPEG = 'JPEG',
    PNG = 'PNG',
    SVG = 'SVG',
    PDF = 'PDF',
    JSON = 'JSON',
}

async function base64SvgToBase64Image(
    originalBase64: string,
    width: number,
    type: 'jpeg' | 'png' = 'png',
): Promise<string> {
    return new Promise((resolve, reject) => {
        const img = document.createElement('img');
        img.onload = () => {
            document.body.appendChild(img);
            const canvas = document.createElement('canvas');
            const ratio = img.clientWidth / img.clientHeight || 1;
            document.body.removeChild(img);
            canvas.width = width;
            canvas.height = width / ratio;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                if (type === 'jpeg') {
                    ctx.fillStyle = 'white';
                    ctx.fillRect(0, 0, canvas.width, canvas.height);
                }
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                try {
                    const data = canvas.toDataURL(`image/${type}`);
                    resolve(data);
                } catch (e: any) {
                    reject();
                }
            } else {
                reject();
            }
        };
        img.src = originalBase64;
    });
}

function downloadImage(base64: string) {
    const link = document.createElement('a');
    link.href = base64;
    link.download = FILE_NAME;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadJson(object: Object) {
    const data = JSON.stringify(object);
    const blob = new Blob([data], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${FILE_NAME}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function downloadPdf(base64: string, width: number, height: number) {
    const padding: number = 20;
    let doc: JsPDF;
    if (width > height) {
        doc = new JsPDF('l', 'mm', [width + padding * 2, height + padding * 2]);
    } else {
        doc = new JsPDF('p', 'mm', [height + padding * 2, width + padding * 2]);
    }
    doc.addImage({
        imageData: base64,
        x: padding,
        y: padding,
        width,
        height,
    });
    doc.save(FILE_NAME);
}

type DownloadOptions = {
    chartRef: RefObject<EChartsReact>;
    chartType: ChartType;
};
const ChartDownloadOptions: React.FC<DownloadOptions> = ({
    chartRef,
    chartType,
}) => {
    const [type, setType] = useState<DownloadType>(DownloadType.JPEG);
    const isTable = chartType === ChartType.TABLE;
    const onDownload = useCallback(async () => {
        const echartsInstance = chartRef.current?.getEchartsInstance();

        if (!echartsInstance) {
            throw new Error('Chart instance not reachable');
        }

        try {
            const svgBase64 = echartsInstance.getDataURL();
            const width = echartsInstance.getWidth();
            const height = echartsInstance.getHeight();

            switch (type) {
                case DownloadType.PDF:
                    downloadPdf(
                        await base64SvgToBase64Image(svgBase64, width),
                        width,
                        height,
                    );
                    break;
                case DownloadType.SVG:
                    downloadImage(svgBase64);
                    break;
                case DownloadType.JPEG:
                    downloadImage(
                        await base64SvgToBase64Image(svgBase64, width, 'jpeg'),
                    );
                    break;
                case DownloadType.PNG:
                    downloadImage(
                        await base64SvgToBase64Image(svgBase64, width),
                    );
                    break;
                case DownloadType.JSON:
                    downloadJson(echartsInstance.getOption());
                    break;
                default: {
                    assertUnreachable(
                        type,
                        `Unexpected download type: ${type}`,
                    );
                }
            }
        } catch (e) {
            console.error(`Unable to download ${type} from chart ${e}`);
        }
    }, [chartRef, type]);

    return (
        <div
            style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-start',
                justifyContent: 'flex-start',
            }}
        >
            <span>
                <b>Options</b>
            </span>
            <Divider />

            <FormGroup label="File format" labelFor="download-type" inline>
                <HTMLSelect
                    id="download-type"
                    value={type}
                    onChange={(e) =>
                        setType(e.currentTarget.value as DownloadType)
                    }
                    options={Object.values(DownloadType).map(
                        (downloadType) => ({
                            value: downloadType,
                            label: downloadType,
                        }),
                    )}
                />
            </FormGroup>
            <Divider />
            {!isTable && (
                <BlueprintButton
                    style={{ alignSelf: 'flex-end' }}
                    intent={Intent.PRIMARY}
                    icon="cloud-download"
                    text="Download"
                    onClick={onDownload}
                />
            )}
        </div>
    );
};

interface ChartDownloadMenuProps {
    projectUuid: string;
    getCsvLink?: (
        limit: number | null,
        onlyRaw: boolean,
        showTableNames: boolean,
        columnOrder: string[],
        customLabels?: Record<string, string>,
    ) => Promise<ApiScheduledDownloadCsv>;
    getGsheetLink?: (
        columnOrder: string[],
        showTableNames: boolean,
        customLabels?: Record<string, string>,
    ) => Promise<ApiScheduledDownloadCsv>;
}

export const ChartDownloadMenu: React.FC<ChartDownloadMenuProps> = memo(
    ({ getCsvLink, getGsheetLink, projectUuid }) => {
        const {
            chartRef,
            chartType,
            tableConfig: { showTableNames, columnProperties, columnOrder },
            resultsData,
        } = useVisualizationContext();
        const eChartsOptions = useEcharts();
        const disabled =
            (chartType === ChartType.TABLE &&
                resultsData?.rows &&
                resultsData.rows.length <= 0) ||
            !resultsData?.metricQuery ||
            chartType === ChartType.BIG_NUMBER ||
            (chartType === ChartType.CARTESIAN && !eChartsOptions);

        const { user } = useApp();

        return chartType === ChartType.TABLE && getCsvLink ? (
            <Can
                I="manage"
                this={subject('ExportCsv', {
                    organizationUuid: user.data?.organizationUuid,
                    projectUuid,
                })}
            >
                <Popover
                    {...COLLAPSABLE_CARD_POPOVER_PROPS}
                    disabled={disabled}
                    position="bottom-end"
                >
                    <Popover.Target>
                        <Button
                            data-testid="export-csv-button"
                            {...COLLAPSABLE_CARD_BUTTON_PROPS}
                            disabled={disabled}
                            px="xs"
                        >
                            <MantineIcon icon={IconShare2} color="gray" />
                        </Button>
                    </Popover.Target>

                    <Popover.Dropdown>
                        <ExportSelector
                            rows={resultsData?.rows}
                            getCsvLink={async (
                                limit: number | null,
                                onlyRaw: boolean,
                            ) =>
                                getCsvLink(
                                    limit,
                                    onlyRaw,
                                    showTableNames,
                                    columnOrder,
                                    getCustomLabelsFromColumnProperties(
                                        columnProperties,
                                    ),
                                )
                            }
                            getGsheetLink={
                                getGsheetLink === undefined
                                    ? undefined
                                    : () =>
                                          getGsheetLink(
                                              columnOrder,
                                              showTableNames,
                                              getCustomLabelsFromColumnProperties(
                                                  columnProperties,
                                              ),
                                          )
                            }
                        />
                    </Popover.Dropdown>
                </Popover>
            </Can>
        ) : chartType === ChartType.TABLE && !getCsvLink ? null : (
            <Popover
                {...COLLAPSABLE_CARD_POPOVER_PROPS}
                disabled={disabled}
                position="bottom-end"
            >
                <Popover.Target>
                    <Button
                        data-testid="export-csv-button"
                        {...COLLAPSABLE_CARD_BUTTON_PROPS}
                        disabled={disabled}
                        px="xs"
                    >
                        <MantineIcon icon={IconShare2} color="gray" />
                    </Button>
                </Popover.Target>

                <Popover.Dropdown>
                    <ChartDownloadOptions
                        chartRef={chartRef}
                        chartType={chartType}
                    />
                </Popover.Dropdown>
            </Popover>
        );
    },
);
