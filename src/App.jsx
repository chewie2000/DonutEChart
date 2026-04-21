import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
  useElementColumns,
} from '@sigmacomputing/plugin';

// ── Colour helpers ────────────────────────────────────────────────────────────
const PALETTE = [
  '#3c79c8', '#e06c4a', '#4caf7d', '#f0b429', '#9b59b6',
  '#17a2b8', '#e91e63', '#8bc34a', '#ff7043', '#5c6bc0',
  '#26a69a', '#ef5350', '#2d2a6e', '#607d8b', '#795548',
];

// ── Value formatter ───────────────────────────────────────────────────────────
function fmtValue(v, prefix, suffix, decimals) {
  const dp = parseInt(decimals);
  const num = isNaN(dp) ? v : Number(v).toFixed(dp);
  return `${prefix}${num}${suffix}`;
}

// ── Persistent chart — lives outside React, never destroyed ──────────────────
const _div = document.createElement('div');
_div.style.cssText = 'width:100%;height:100vh;';
const _chart = echarts.init(_div);
const _ro = new ResizeObserver(() => _chart.resize());
_ro.observe(_div);

// ── Editor fields ─────────────────────────────────────────────────────────────
const EDITOR_FIELDS = [
  { name: 'source',          type: 'element' },
  { name: 'labelCol',        type: 'column',   source: 'source', label: 'Label column',    allowedTypes: ['text', 'number', 'integer', 'datetime'] },
  { name: 'valueCol',        type: 'column',   source: 'source', label: 'Value column',    allowedTypes: ['number', 'integer'] },
  { name: 'holeSize',        type: 'text',                       label: 'Hole size %',      defaultValue: '50' },
  { name: 'showLabels',      type: 'checkbox',                   label: 'Show labels',      defaultValue: true },
  { name: 'labelType',       type: 'radio',                      label: 'Label shows',      values: ['percent', 'value', 'both'], defaultValue: 'percent', singleLine: true },
  { name: 'valuePrefix',     type: 'text',                       label: 'Value prefix' },
  { name: 'valueSuffix',     type: 'text',                       label: 'Value suffix' },
  { name: 'valueDecimals',   type: 'text',                       label: 'Decimal places' },
  { name: 'legendPosition',  type: 'radio',                      label: 'Legend position',  values: ['top', 'bottom', 'left', 'right'], defaultValue: 'left', singleLine: true },
  { name: 'legendWrap',      type: 'checkbox',                   label: 'Wrap legend',      defaultValue: true },
  { name: 'legendMaxWidth',  type: 'text',                       label: 'Legend max width' },
  { name: 'showLegend',      type: 'checkbox',                   label: 'Show legend',      defaultValue: true },
];

export default function App() {
  const rootRef = useRef(null);

  useEditorPanelConfig(EDITOR_FIELDS);

  const config  = useConfig();
  const sourceId = config?.source;
  const labelId  = config?.labelCol;
  const valueId  = config?.valueCol;

  const holeSize      = Math.min(95, Math.max(0, parseInt(config?.holeSize ?? '50') || 50));
  const showLabels    = config?.showLabels    !== false;
  const labelType     = config?.labelType     || 'percent';
  const valuePrefix   = config?.valuePrefix   || '';
  const valueSuffix   = config?.valueSuffix   || '';
  const valueDecimals = config?.valueDecimals || '';
  const legendPos     = config?.legendPosition || 'left';
  const legendWrap    = config?.legendWrap    !== false;
  const legendMaxW    = parseInt(config?.legendMaxWidth) || null;
  const showLegend    = config?.showLegend    !== false;

  const data = useElementData(sourceId);
  const cols = useElementColumns(sourceId);

  const labels = (data?.[labelId] ?? []).map(String);
  const values = (data?.[valueId] ?? []).map(Number);

  useEffect(() => {
    const root = rootRef.current;
    if (root && !root.contains(_div)) root.appendChild(_div);
  });

  useEffect(() => {
    if (!labels.length || !values.length) return;

    const total = values.reduce((s, v) => s + v, 0);

    const seriesData = labels.map((name, i) => ({
      name,
      value: values[i],
      itemStyle: { color: PALETTE[i % PALETTE.length] },
    }));

    const labelFormatter = ({ name, value, percent }) => {
      if (labelType === 'value') return fmtValue(value, valuePrefix, valueSuffix, valueDecimals);
      if (labelType === 'both')  return `${name}\n${fmtValue(value, valuePrefix, valueSuffix, valueDecimals)} (${percent}%)`;
      return `${percent}%`;
    };

    const isVertical = legendPos === 'top' || legendPos === 'bottom';

    const legendConfig = {
      show: showLegend,
      orient: isVertical ? 'horizontal' : 'vertical',
      [legendPos]: legendPos === 'top' || legendPos === 'bottom' ? 10 : 10,
      ...(legendPos === 'left'   ? { left: 10, top: 'middle' } : {}),
      ...(legendPos === 'right'  ? { right: 10, top: 'middle' } : {}),
      ...(legendPos === 'top'    ? { top: 10, left: 'center' } : {}),
      ...(legendPos === 'bottom' ? { bottom: 10, left: 'center' } : {}),
      type: legendWrap ? 'scroll' : 'plain',
      ...(legendMaxW && !isVertical ? { width: legendMaxW } : {}),
      ...(legendMaxW && isVertical  ? { width: legendMaxW } : {}),
    };

    // Grid padding to make room for the legend
    const gridPad = showLegend ? 140 : 20;
    const center = [
      legendPos === 'left'  ? `calc(50% + ${gridPad / 2}px)` :
      legendPos === 'right' ? `calc(50% - ${gridPad / 2}px)` : '50%',
      legendPos === 'top'    ? `calc(50% + ${gridPad / 2}px)` :
      legendPos === 'bottom' ? `calc(50% - ${gridPad / 2}px)` : '50%',
    ];

    const option = {
      animation: false,
      legend: legendConfig,
      tooltip: {
        trigger: 'item',
        formatter: ({ name, value, percent }) =>
          `${name}<br/>${fmtValue(value, valuePrefix, valueSuffix, valueDecimals)} (${percent}%)`,
      },
      series: [{
        type: 'pie',
        radius: [`${holeSize}%`, '70%'],
        center,
        data: seriesData,
        label: {
          show: showLabels,
          formatter: labelFormatter,
        },
        emphasis: {
          itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0,0,0,0.3)' },
        },
      }],
    };

    _chart.setOption(option, { replaceMerge: ['series'] });
  });

  if (!labelId || !valueId) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: '#999', fontSize: 13 }}>
        Select a label and value column.
      </div>
    );
  }

  return <div ref={rootRef} style={{ width: '100%', height: '100vh' }} />;
}
