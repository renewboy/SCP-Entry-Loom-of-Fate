import React from 'react';
import { MAIN_RING, SIDE_MARK } from './NetworkNode';

interface NetworkLegendProps {
  legendRef?: React.Ref<HTMLDivElement>;
  className?: string;
  /** Unknown zones and the route only exist once a run is under way */
  inGame?: boolean;
  t: (key: string, params?: Record<string, string | number>) => any;
}

const NetworkLegend: React.FC<NetworkLegendProps> = ({ legendRef, className = 'net-legend', inGame = true, t }) => (
  <div className={className} ref={legendRef}>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="4.5" fill="#33ff00" /></svg>{t('stage.network.legend_low')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="13,7 10,12.2 4,12.2 1,7 4,1.8 10,1.8" fill="#f59e0b" /></svg>{t('stage.network.legend_medium')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><polygon points="7,1 13,12 1,12" fill="#ef4444" /></svg>{t('stage.network.legend_high')}</span>
    {inGame && <span><b className="lg-q">?</b>{t('stage.network.unknown')}</span>}
    {inGame && <span><i className="lg-thread" />{t('stage.network.legend_route')}</span>}
    <span><svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="5.5" fill="none" stroke={MAIN_RING} strokeDasharray="2.4 1.8" /></svg>{t('game.map_main_hint')}</span>
    <span><svg width="14" height="14" viewBox="0 0 14 14"><rect x="3.5" y="3.5" width="7" height="7" fill={SIDE_MARK} /></svg>{t('game.map_side_hint')}</span>
    <span><b className="lg-q">S</b>{t('game.map_start')}</span>
    <span><b className="lg-lock">⊘</b>{t('stage.network.legend_gate')}</span>
  </div>
);

export default NetworkLegend;
