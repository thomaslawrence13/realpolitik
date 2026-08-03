# Quick Start: Using New Features

## Map Legend Component

The map legend provides a visual key for interpreting the map's color encodings.

### How to Use

1. **Integration**: The `MapLegend` component is ready to be integrated into your App.tsx

2. **Add to App.tsx**:
   ```tsx
   import { MapLegend } from './components/MapLegend';
   
   // In your App component, add state:
   const [legendOpen, setLegendOpen] = useState(false);
   const [fillMode, setFillMode] = useState<MapFillMode>('alignment');
   
   // Add to render:
   <MapLegend 
     open={legendOpen} 
     onToggle={() => setLegendOpen(!legendOpen)}
     fillMode={fillMode}
   />
   ```

3. **CSS**: Styles are already included in `styles.css` (appended at end of file)

### Features

- **Dynamic Content**: Automatically shows relevant legend based on current `fillMode`
- **Alignment Mode**: Shows bloc colors (blue/red/yellow/purple)
- **Risk Mode**: Shows risk tiers (high/medium/low)
- **Confidence Mode**: Shows confidence levels
- **Shift Mode**: Shows alignment shift directions
- **Metric Modes**: Shows color scales for economic/demographic data

### Keyboard Shortcuts

Existing shortcuts (from ShortcutsHelp.tsx):
- `[` - Toggle left panel
- `]` - Toggle right panel  
- `\` - Toggle bottom drawer
- `Space` - Play/pause timeline
- `/` - Focus search
- `?` - Toggle help modal

**Recommended addition**: Add `L` key to toggle legend

## Next Steps

### Immediate Integration Tasks

1. **Wire up MapLegend in App.tsx**
   - Import component
   - Add state management
   - Render in map container
   - Add keyboard shortcut handler

2. **Add Export/Import UI**
   - Add buttons to TopBar or BottomDrawer
   - Wire up existing persistence functions
   - Add user feedback (toast notifications)

3. **Enhance Documentation**
   - Update README with feature list
   - Add screenshots/gifs
   - Create tutorial mode

### Testing Checklist

- [ ] Build passes: `npm run build`
- [ ] All tests pass: `npm test`
- [ ] Legend renders correctly in all fill modes
- [ ] Responsive design works on mobile
- [ ] Keyboard shortcuts function properly
- [ ] No console errors

## File Structure

```
src/
├── components/
│   ├── MapLegend.tsx          # NEW: Legend component
│   ├── ui.tsx                 # Shared UI primitives
│   └── ...
├── styles.css                 # UPDATED: Added legend styles
├── lib/
│   ├── constants.ts           # Configuration values
│   └── ...
└── ...

Documentation/
├── FEATURES.md                # NEW: Feature roadmap
├── QUICKSTART_FEATURES.md     # NEW: This file
├── README.md                  # Existing documentation
└── IMPROVEMENTS.md            # Previous improvements
```

## Support

For questions or issues:
1. Check existing tests in `src/**/*.test.ts`
2. Review type definitions in `src/types.ts`
3. Consult FEATURES.md for roadmap context
