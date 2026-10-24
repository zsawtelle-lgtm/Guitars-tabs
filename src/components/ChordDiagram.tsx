import type { ChordShape } from "../lib/chordShapes";

const FRETS_SHOWN = 5;

interface Props {
  name: string;
  shape?: ChordShape;
  size?: number;
}

export function ChordDiagram({ name, shape, size = 1 }: Props) {
  const w = 100;
  const h = 128;
  const left = 22;
  const top = 34;
  const gridW = 60;
  const gridH = 80;
  const stringGap = gridW / 5;
  const fretGap = gridH / FRETS_SHOWN;
  const x = (s: number) => left + s * stringGap;
  // Center of the fret cell `f` rows below the top of the diagram.
  const y = (row: number) => top + (row - 0.5) * fretGap;

  if (!shape) {
    return (
      <figure className="chord-diagram" style={{ width: w * size }}>
        <figcaption>{name}</figcaption>
        <div className="chord-diagram-missing" style={{ height: (h - 22) * size }}>
          No diagram
        </div>
      </figure>
    );
  }

  const base = shape.baseFret;
  const row = (fret: number) => fret - base + 1;

  return (
    <figure className="chord-diagram" style={{ width: w * size }}>
      <figcaption>{name}</figcaption>
      <svg viewBox={`0 0 ${w} ${h - 22}`} width={w * size} height={(h - 22) * size} role="img"
        aria-label={`${name} chord diagram`}>
        <g transform="translate(0,-12)">
          {/* Open / muted markers above the nut */}
          {shape.frets.map((f, s) =>
            f === 0 ? (
              <circle key={s} cx={x(s)} cy={top - 8} r={3.6} className="cd-open" />
            ) : f < 0 ? (
              <text key={s} x={x(s)} y={top - 4} className="cd-muted">×</text>
            ) : null,
          )}
          {/* Nut or starting fret number */}
          {base === 1 ? (
            <rect x={left - 1} y={top - 3} width={gridW + 2} height={4} className="cd-nut" />
          ) : (
            <text x={left - 7} y={y(1) + 4} className="cd-basefret">{base}</text>
          )}
          {Array.from({ length: FRETS_SHOWN + 1 }, (_, i) => (
            <line key={"f" + i} x1={left} x2={left + gridW} y1={top + i * fretGap} y2={top + i * fretGap}
              className="cd-fret" />
          ))}
          {Array.from({ length: 6 }, (_, s) => (
            <line key={"s" + s} x1={x(s)} x2={x(s)} y1={top} y2={top + gridH} className="cd-string" />
          ))}
          {shape.barre && (
            <rect
              x={x(shape.barre.from) - 5}
              y={y(row(shape.barre.fret)) - 5}
              width={x(shape.barre.to) - x(shape.barre.from) + 10}
              height={10}
              rx={5}
              className="cd-dot"
            />
          )}
          {shape.frets.map((f, s) =>
            f > 0 && !(shape.barre && f === shape.barre.fret && s >= shape.barre.from && s <= shape.barre.to) ? (
              <g key={"d" + s}>
                <circle cx={x(s)} cy={y(row(f))} r={5.4} className="cd-dot" />
                {shape.fingers?.[s] ? (
                  <text x={x(s)} y={y(row(f)) + 3} className="cd-finger">{shape.fingers[s]}</text>
                ) : null}
              </g>
            ) : null,
          )}
        </g>
      </svg>
    </figure>
  );
}
