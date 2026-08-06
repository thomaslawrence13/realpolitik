import { memo } from 'react';
import type { MutableRefObject } from 'react';
import type { Alignment, MapFillMode, OverlayMode, SimulatedCountry } from '../../types';
import { countries, countryPathStrings } from '../../lib/map';
import { resolveFill, NEUTRAL } from './countryColors';
import { overlayColor } from './relationshipArcs';

type CountryLayersProps = {
  byName: Map<string, SimulatedCountry>;
  baselineByName: Map<string, SimulatedCountry>;
  visibleNames: Set<string>;
  selectedName: string;
  relatedNames: Set<string>;
  overlayMode: OverlayMode;
  fillMode: MapFillMode;
  alignmentColor: Record<Alignment, string>;
  setHoveredName: (name: string | null) => void;
  setHoveredCountry: (name: string | null) => void;
  hoveredNameRef: MutableRefObject<string | null>;
  hoveredIsParamRef: MutableRefObject<boolean>;
};

// ─── Memoized country paths layer ────────────────────────────────────────────
// Defined outside MapCanvas so React.memo has stable component identity.
// Only re-renders when alignment data, filters, selection, or overlays change —
// NOT on hover or zoom/pan.
export const CountryLayers = memo(function CountryLayers({
  byName,
  baselineByName,
  visibleNames,
  selectedName,
  relatedNames,
  overlayMode,
  fillMode,
  alignmentColor,
  setHoveredName,
  setHoveredCountry,
  hoveredNameRef,
  hoveredIsParamRef,
}: CountryLayersProps) {
  return (
    <>
      {countries.map((country) => {
        const name = country.properties.name;
        const simulated = byName.get(name);
        const baseline = baselineByName.get(name);
        const isParameterized = Boolean(simulated);
        const isVisible = isParameterized && visibleNames.has(name);
        const isSelected = selectedName === name;
        const isRelated = relatedNames.has(name);

        const fill = simulated
          ? resolveFill(fillMode, { simulated, baseline, alignmentColor })
          : NEUTRAL;
        const opacity = !isParameterized ? 0.3 : isVisible ? 1 : 0.2;

        let stroke = 'rgba(148,163,184,0.18)';
        let strokeWidth = 0.4;
        if (isRelated && overlayMode !== 'none') { stroke = overlayColor[overlayMode]; strokeWidth = 1.3; }
        if (isSelected) { stroke = '#f8fafc'; strokeWidth = 2; }

        return (
          <path
            key={`${country.id ?? name}-${name}`}
            d={countryPathStrings.get(name) ?? undefined}
            fill={fill}
            fillOpacity={opacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            vectorEffect="non-scaling-stroke"
            filter={isSelected ? 'url(#selected-glow)' : undefined}
            className="country-path"
            onPointerEnter={() => {
              hoveredNameRef.current = name;
              hoveredIsParamRef.current = isParameterized;
              setHoveredName(name);
              setHoveredCountry(name);
            }}
            onPointerLeave={() => {
              hoveredNameRef.current = null;
              hoveredIsParamRef.current = false;
              setHoveredName(null);
              setHoveredCountry(null);
            }}
          />
        );
      })}
    </>
  );
});
