import { useEffect, useRef } from 'react';
import * as echarts from 'echarts';
import {
  useConfig,
  useEditorPanelConfig,
  useElementData,
  useElementColumns,
} from '@sigmacomputing/plugin';

// ── Palettes ──────────────────────────────────────────────────────────────────
const PALETTES = {
  default: ['#3c79c8','#e06c4a','#4caf7d','#f0b429','#9b59b6','#17a2b8','#e91e63','#8bc34a','#ff7043','#5c6bc0','#26a69a','#ef5350'],
  blues:   ['#003f88','#1565c0','#1976d2','#2196f3','#42a5f5','#64b5f6','#90caf9','#0d47a1','#0277bd','#01579b'],
  warm:    ['#b71c1c','#e53935','#ff5722','#ff7043','#ff9800','#ffa726','#ffb300','#e91e63','#f06292','#d84315'],
  cool:    ['#1a237e','#1565c0','#00838f','#00695c','#2e7d32','#558b2f','#5c6bc0','#26a69a','#0097a7','#388e3c'],
  pastel:  ['#7eb8f7','#f7a07e','#7ef7b0','#f7d97e','#c47ef7','#7ef0f7','#f77eb8','#b0f77e','#f7b07e','#7e9cf7'],
  earthy:  ['#795548','#a1887f','#6d4c41','#8d6e63','#4e342e','#bf8c6b','#d7a97a','#a0785a','#c49a6c','#7d5a4f'],
};

function parsePalette(raw) {
  return (raw || '').split(',').map(s => s.trim()).filter(s => /^#[0-9a-fA-F]{3,6}$/.test(s));
}

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
  { name: 'paletteMode',     type: 'radio',                      label: 'Colour palette',    values: ['theme', 'custom'], defaultValue: 'theme', singleLine: true },
  { name: 'paletteTheme',    type: 'radio',                      label: 'Theme',             values: ['default', 'blues', 'warm', 'cool', 'pastel', 'earthy'], defaultValue: 'default', singleLine: false },
  { name: 'paletteCustom',   type: 'text',                       label: 'Custom colours',    defaultValue: '' },
  { name: 'hideOverlapLabels', type: 'checkbox',                  label: 'Hide overlapping labels', defaultValue: true },
  { name: 'labelFontSize',   type: 'text',                       label: 'Label font size',   defaultValue: '12' },
  { name: 'labelFontStyle',  type: 'radio',                      label: 'Label font style',  values: ['normal', 'bold', 'italic'], defaultValue: 'normal', singleLine: true },
  { name: 'labelColor',      type: 'color',                      label: 'Label color' },
  { name: 'legendFontSize',  type: 'text',                       label: 'Legend font size',  defaultValue: '12' },
  { name: 'legendFontStyle', type: 'radio',                      label: 'Legend font style', values: ['normal', 'bold', 'italic'], defaultValue: 'normal', singleLine: true },
  { name: 'legendColor',     type: 'color',                      label: 'Legend color' },
  { name: 'legendIcon',      type: 'radio',                      label: 'Legend icon',       values: ['circle', 'rectangle'], defaultValue: 'circle', singleLine: true },
  { name: 'legendItemGap',   type: 'text',                       label: 'Legend item gap',   defaultValue: '10' },
  { name: 'legendIconWidth', type: 'text',                       label: 'Legend icon width', defaultValue: '25' },
  { name: 'legendIconHeight',type: 'text',                       label: 'Legend icon height',defaultValue: '14' },
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
  const paletteMode   = config?.paletteMode  || 'theme';
  const paletteTheme  = config?.paletteTheme || 'default';
  const paletteCustom = config?.paletteCustom || '';
  const activePalette = paletteMode === 'custom'
    ? (parsePalette(paletteCustom).length ? parsePalette(paletteCustom) : PALETTES.default)
    : (PALETTES[paletteTheme] || PALETTES.default);

  const showLabels        = config?.showLabels        !== false;
  const hideOverlapLabels = config?.hideOverlapLabels !== false;
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
  const legendIcon       = config?.legendIcon === 'rectangle' ? 'roundRect' : (config?.legendIcon || 'circle');
  const legendItemGap    = Math.max(0, parseInt(config?.legendItemGap)    || 10);
  const legendIconWidth  = Math.max(4, parseInt(config?.legendIconWidth)  || 25);
  const legendIconHeight = Math.max(4, parseInt(config?.legendIconHeight) || 14);
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
      itemStyle: { color: activePalette[i % activePalette.length] },
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
      itemGap: legendItemGap,
      itemWidth: legendIconWidth,
      itemHeight: legendIconHeight,
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
          overflow: 'none',
          ...fontStyleProps(labelFontStyle),
          ...(labelColor ? { color: labelColor } : {}),
        },
        labelLayout: { hideOverlap: hideOverlapLabels },
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
