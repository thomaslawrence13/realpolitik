import { memo } from 'react';
import type { MutableRefObject } from 'react';
import type { Alignment, MapFillMode, OverlayMode, SimulatedCountry } from '../../types';
import { countries, countryPathStrings } from '../../lib/map';
import { resolveFill, NEUTRAL } from './countryColors';
import { overlayColor } from './relationshipArcs';

const FILTERED_OPACITY = 0.28;
const UNTRACKED_OPACITY = 0.42;

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

/**
 * Memoized country paths — re-renders on data/selection/overlay changes,
 * not on zoom/pan. Hover rings are drawn separately in MapCanvas.
 */
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
        const opacity = isSelected
          ? 1
          : !isParameterized
            ? UNTRACKED_OPACITY
            : isVisible
              ? 1
              : FILTERED_OPACITY;

        let stroke = 'rgba(186, 200, 222, 0.14)';
        let strokeWidth = 0.35;
        if (isRelated && overlayMode !== 'none') {
          stroke = overlayColor[overlayMode];
          strokeWidth = 1.15;
        }
        if (isSelected) {
          stroke = 'transparent';
          strokeWidth = 0;
        }

        return (
          <path
            key={`${country.id ?? name}-${name}`}
            d={countryPathStrings.get(name) ?? undefined}
            fill={fill}
            fillOpacity={opacity}
            stroke={stroke}
            strokeWidth={strokeWidth}
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
            className={`country-path${isSelected ? ' country-path-selected' : ''}${isRelated ? ' country-path-related' : ''}`}
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
