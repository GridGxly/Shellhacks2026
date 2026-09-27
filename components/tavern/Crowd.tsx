'use client';
import { memo } from 'react';
import { CROWD_POSITIONS, type TomatoThrow } from './Gags';

interface CrowdProps {
  mode: 'idle' | 'hush' | 'sway' | 'clap' | 'boo';
  cheer: boolean;
  elapsed: number;
  throws: TomatoThrow[];
  restrained?: boolean;
}

/** Eight separate, deliberately staggered poses keep the audience from moving as one shape. */
function Crowd({ mode, cheer, elapsed, throws, restrained = false }: CrowdProps) {
  return <svg className={`tavern-crowd tavern-crowd-${mode}`} viewBox="0 0 1440 900" shapeRendering="crispEdges" aria-hidden="true">
    {CROWD_POSITIONS.map((p, i) => {
      const throwing = throws.find((t) => t.npc === i && elapsed >= t.release - 250 && elapsed < t.release + 180);
      const windup = throwing && elapsed < throwing.release;
      const release = throwing && elapsed >= throwing.release;
      // A thrower's preparation stays visible even while everyone else applauds.
      const clapping = !throwing && mode === 'clap' && (!restrained || i % 2 === 0);
      const armsUp = !throwing && (cheer || (!restrained && clapping && (i === 1 || i === 6)));
      const colors = ['#2A2637', '#252A34', '#332833', '#263237'];
      return <g key={i} transform={`translate(${p.x} ${p.y})`}>
        <g className={mode === 'sway' ? 'tavern-crowd-sway' : undefined} style={{ animationDelay: `${i * -83}ms` }}>
          {/* shoulder rim, hair, coat and chair are built in four-pixel blocks */}
          <path d="M-24 52H-32V100H-40V148H64V100H56V52H44V40H-12V52Z" fill="#6F513C" />
          <path d="M-20 56H-28V104H-36V148H60V104H52V56H40V44H-8V56Z" fill={colors[i % colors.length]} />
          <path d="M-8 0H32V8H40V36H32V48H-8V36H-16V8H-8Z" fill="#7F634B" />
          <path d="M-4 4H28V12H36V36H28V44H-4V36H-12V12H-4Z" fill="#171928" />
          <path d={i % 3 === 0 ? 'M-16 8H40V0H28V-8H-4V0H-16Z' : i % 3 === 1 ? 'M-12 12H-20V-4H-4V-12H28V-4H44V12H32V4H0V12Z' : 'M-12 12H36V0H28V-8H0V0H-12Z'} fill="#0F1120" />
          <path d="M-4 44H28V56H-4Z" fill="#101126" />
          {clapping && !armsUp ? <g className="tavern-clapping" style={{ animationDelay: `${(i * 43) % 150}ms` }}>
            <path className="tavern-clap-open" d="M-28 64V44H-16V56H-8V72H-20V84H-28Z M52 64V44H40V56H32V72H44V84H52Z" fill="#96714D" />
            <path className="tavern-clap-closed" d="M-28 76V64H-12V56H4V48H20V56H36V64H52V76H28V64H-4V76Z" fill="#B58B5C" />
          </g> : armsUp ? <g>
            <path d="M-28 76H-40V20H-48V4H-32V16H-24V52H-12V76Z M40 76H64V28H72V12H56V24H48V52H40Z" fill="#342B32" />
            <path d="M-48-8H-24V12H-48Z M-24-4H-16V8H-24Z" fill="#E8A93A" /><path d="M-48-12H-24V-4H-48Z" fill="#FFF3D6" />
          </g> : windup ? <g>
            <path d="M40 76H56V40H44V20H28V36H40Z" fill="#8F684B" /><rect x="24" y="8" width="16" height="16" fill="#E8434F" />
          </g> : release ? <path d="M40 76H52V28H48V8H32V24H36V52H28V76Z" fill="#8F684B" /> : <g>
            <path d="M-24 64H-36V104H-20V92H-12V72Z M44 64H56V104H40V92H32V72Z" fill="#171928" />
            {mode !== 'hush' && i % 3 === 0 && <g><rect x="-44" y="76" width="24" height="24" fill="#A77233" /><rect x="-44" y="72" width="24" height="8" fill="#D9C9A6" /></g>}
          </g>}
        </g>
      </g>;
    })}
    <path d="M0 884H1440V900H0Z" fill="#07070F" />
  </svg>;
}

export default memo(Crowd);
