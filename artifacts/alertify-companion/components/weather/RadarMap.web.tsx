import React from 'react';
import { radarHtml, type RadarProps } from './radar-html';
export default function RadarMap(props: RadarProps) {
  return React.createElement('iframe', { title: 'RainViewer weather radar with selected watch zone or estimated route', srcDoc: radarHtml(props), sandbox: 'allow-scripts', style: { height: 400, width: '100%', border: 0, borderRadius: 16 } });
}
