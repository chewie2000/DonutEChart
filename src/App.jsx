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
  { name: 'labelFontSize',   type: 'text',                       label: 'Label font size',   defaultValue: '12' },
  { name: 'labelFontStyle',  type: 'radio',                      label: 'Label font style',  values: ['normal', 'bold', 'italic'], defaultValue: 'normal', singleLine: true },
  { name: 'labelColor',      type: 'color',                      label: 'Label color' },
  { name: 'legendFontSize',  type: 'text',                       label: 'Legend font size',  defaultValue: '12' },
  { name: 'legendFontStyle', type: 'radio',                      label: 'Legend font style', values: ['normal', 'bold', 'italic'], defaultValue: 'normal', singleLine: true },
  { name: 'legendColor',     type: 'color',                      label: 'Legend color' },
  { name: 'legendIcon',      type: 'radio',                      label: 'Legend icon',       values: ['circle', 'roundRect'], defaultValue: 'circle', singleLine: true },
  { name: 'legendHAlign',    type: 'radio',                      label: 'Legend horizontal', values: ['left', 'center', 'right'], defaultValue: 'left', singleLine: true },
  { name: 'legendVAlign',    type: 'radio',                      label: 'Legend vertical',   values: ['top', 'middle', 'bottom'], defaultValue: 'middle', singleLine: true },
  { name: 'legendOrient',    type: 'radio',                      label: 'Legend layout',     values: ['horizontal', 'vertical'], defaultValue: 'vertical', singleLine: true },
  { name: 'legendWrap',      type: 'checkbox',                   label: 'Wrap legend',      defaultValue: true },
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
  const labelFontSize  = Math.max(8, parseInt(config?.labelFontSize)  || 12);
  const labelFontStyle = config?.labelFontStyle  || 'normal';
  const labelColor     = config?.labelColor      || null;
  const legendFontSize = Math.max(8, parseInt(config?.legendFontSize) || 12);
  const legendFontStyle= config?.legendFontStyle || 'normal';
  const legendColor    = config?.legendColor     || null;
  const legendIcon     = config?.legendIcon      || 'circle';
  const legendHAlign  = config?.legendHAlign  || 'left';
  const legendVAlign  = config?.legendVAlign  || 'middle';
  const legendOrient  = config?.legendOrient  || 'vertical';
  const legendWrap    = config?.legendWrap    !== false;
  const showLegend    = config?.showLegend    !== false;

  const data = useElementData(sourceId);

  const labels = (data?.[labelId] ?? []).map(String);
  const values = (data?.[valueId] ?? []).map(Number);

  useEffect(() => {
    const root = rootRef.current;
    if (root && !root.contains(_div)) root.appendChild(_div);
  });

  useEffect(() => {
    if (!labels.length || !values.length) return;

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

    const fontStyleProps = style => ({
      fontWeight: style === 'bold' ? 'bold' : 'normal',
      fontStyle:  style === 'italic' ? 'italic' : 'normal',
    });

    const legendConfig = {
      show: showLegend,
      orient: legendOrient,
      type: legendWrap ? 'scroll' : 'plain',
      left: legendHAlign,
      top: legendVAlign,
      icon: legendIcon,
      textStyle: {
        fontSize: legendFontSize,
        ...fontStyleProps(legendFontStyle),
        ...(legendColor ? { color: legendColor } : {}),
      },
    };

    // Shift chart center away from the legend edge so they don't overlap
    const cx =
      legendHAlign === 'left'  ? '58%' :
      legendHAlign === 'right' ? '42%' : '50%';
    const cy =
      legendVAlign === 'top'    ? '58%' :
      legendVAlign === 'bottom' ? '42%' : '50%';
    const center = showLegend ? [cx, cy] : ['50%', '50%'];

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
          fontSize: labelFontSize,
          ...fontStyleProps(labelFontStyle),
          ...(labelColor ? { color: labelColor } : {}),
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
