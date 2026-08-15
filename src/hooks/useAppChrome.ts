import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, MutableRefObject } from 'react';
import type { DrawerTab } from '../components/BottomDrawer';
import type { InspectorTab } from '../components/RightInspector';
import { normalizeInspectorTab } from '../components/RightInspector';
import { UI_TIMING, STORAGE_KEYS } from '../lib/constants';

const MIN_DRAWER_HEIGHT = UI_TIMING.minDrawerHeight;
const MAX_DRAWER_HEIGHT_RATIO = UI_TIMING.maxDrawerHeightRatio;
const WELCOME_DISMISSED_KEY = STORAGE_KEYS.welcomeDismissed;
const INTERACTIVE_SHORTCUT_TAGS = new Set(['BUTTON', 'INPUT', 'SELECT', 'TEXTAREA', 'A']);
const INTERACTIVE_SHORTCUT_ROLES = new Set(['button', 'textbox', 'link']);

const maxDrawerHeight = () => Math.floor(window.innerHeight * MAX_DRAWER_HEIGHT_RATIO);

const isMobile = () => typeof window !== 'undefined' && window.innerWidth < 1080;

const isInteractiveShortcutTarget = (target: EventTarget | null): target is HTMLElement => {
  if (!(target instanceof HTMLElement)) return false;
  if (INTERACTIVE_SHORTCUT_TAGS.has(target.tagName)) return true;
  const role = target.getAttribute('role');
  if (role && INTERACTIVE_SHORTCUT_ROLES.has(role)) return true;
  return target.isContentEditable;
};

const isWelcomeDismissed = () => {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(WELCOME_DISMISSED_KEY) === '1';
  } catch {
    return false;
  }
};

const markWelcomeDismissed = () => {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(WELCOME_DISMISSED_KEY, '1');
  } catch {
    // ignore
  }
};

type PersistedChrome = {
  drawerOpen?: boolean;
  drawerTab?: string;
  drawerHeight?: number;
  inspectorTab?: string;
};

/**
 * Shell chrome: side panels, drawer, help/welcome, keyboard shortcuts, search focus.
 */
export function useAppChrome(persisted: PersistedChrome | null | undefined) {
  const [leftOpen, setLeftOpen] = useState<boolean>(() => !isMobile());
  const [rightOpen, setRightOpen] = useState<boolean>(() => !isMobile());
  const [drawerOpen, setDrawerOpen] = useState<boolean>(persisted?.drawerOpen ?? false);
  const [drawerTab, setDrawerTab] = useState<DrawerTab>(() => {
    const raw = persisted?.drawerTab as string | undefined;
    if (raw === 'analysis' || raw === 'events' || raw === 'history' || raw === 'scenario' || raw === 'feed') {
      return 'methodology';
    }
    const valid: DrawerTab[] = ['index', 'movers', 'methodology'];
    return valid.includes(raw as DrawerTab) ? (raw as DrawerTab) : 'index';
  });
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>(() =>
    normalizeInspectorTab(persisted?.inspectorTab as string | undefined),
  );
  const [drawerHeight, setDrawerHeight] = useState(persisted?.drawerHeight ?? 320);
  const [helpOpen, setHelpOpen] = useState(false);
  const [welcomeOpen, setWelcomeOpen] = useState<boolean>(() => !isWelcomeDismissed());
  const [search, setSearch] = useState('');
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const mobileRef = useRef(isMobile());

  const handleDrawerResizeStart = useCallback(
    (startClientY: number) => {
      const startH = drawerHeight;
      const onMove = (event: MouseEvent) => {
        const delta = startClientY - event.clientY;
        setDrawerHeight(Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), startH + delta)));
      };
      const onUp = () => {
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup', onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    },
    [drawerHeight],
  );

  const handleDrawerResizeStep = useCallback((delta: number) => {
    setDrawerHeight((h) => Math.max(MIN_DRAWER_HEIGHT, Math.min(maxDrawerHeight(), h + delta)));
  }, []);

  const handleDrawerResizeTo = useCallback((edge: 'min' | 'max') => {
    setDrawerHeight(edge === 'min' ? MIN_DRAWER_HEIGHT : maxDrawerHeight());
  }, []);

  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (isInteractiveShortcutTarget(event.target)) return;
      if (event.key === '[') {
        if (isMobile()) {
          setRightOpen(false);
          setDrawerOpen(false);
        }
        setLeftOpen((value) => !value);
      }
      if (event.key === ']') {
        if (isMobile()) {
          setLeftOpen(false);
          setDrawerOpen(false);
        }
        setRightOpen((value) => !value);
      }
      if (event.key === '\\') {
        if (isMobile()) {
          setLeftOpen(false);
          setRightOpen(false);
        }
        setDrawerOpen((value) => !value);
      }
      if (event.key === '/') {
        event.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
      }
      if (event.key === '?') {
        event.preventDefault();
        setHelpOpen((value) => !value);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

  // Keep the shell coherent when a device rotates or a responsive viewport is
  // resized. Side panels and the drawer are mutually exclusive on mobile so
  // the map never gets trapped behind two full-screen surfaces.
  useEffect(() => {
    const handleResize = () => {
      const nextMobile = isMobile();
      setDrawerHeight((height) => Math.min(height, maxDrawerHeight()));
      if (nextMobile !== mobileRef.current) {
        mobileRef.current = nextMobile;
        setLeftOpen(!nextMobile);
        setRightOpen(!nextMobile);
        if (nextMobile) setDrawerOpen(false);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const shellStyle = useMemo(
    () => ({ '--drawer-h': `${drawerHeight}px` }) as CSSProperties,
    [drawerHeight],
  );

  const closeWelcome = useCallback(() => {
    setWelcomeOpen(false);
    markWelcomeDismissed();
  }, []);

  const handleWelcomeFocusSearch = useCallback(() => {
    setLeftOpen(true);
    closeWelcome();
    searchInputRef.current?.focus();
    searchInputRef.current?.select();
  }, [closeWelcome]);

  const handleWelcomeOpenMethodology = useCallback(() => {
    setDrawerOpen(true);
    setDrawerTab('methodology');
    closeWelcome();
  }, [closeWelcome]);

  const handleWelcomeOpenShortcuts = useCallback(() => {
    setHelpOpen(true);
    closeWelcome();
  }, [closeWelcome]);

  const handleToggleLeft = useCallback(() => {
    if (isMobile()) {
      setRightOpen(false);
      setDrawerOpen(false);
    }
    setLeftOpen((v) => !v);
  }, []);
  const handleToggleRight = useCallback(() => {
    if (isMobile()) {
      setLeftOpen(false);
      setDrawerOpen(false);
    }
    setRightOpen((v) => !v);
  }, []);
  const handleToggleDrawer = useCallback(() => {
    if (isMobile()) {
      setLeftOpen(false);
      setRightOpen(false);
    }
    setDrawerOpen((v) => !v);
  }, []);
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), []);
  const handleToggleHelp = useCallback(() => setHelpOpen((v) => !v), []);
  const handleCloseHelp = useCallback(() => setHelpOpen(false), []);
  const handleClearSearch = useCallback(() => setSearch(''), []);

  return {
    leftOpen,
    rightOpen,
    drawerOpen,
    drawerTab,
    inspectorTab,
    drawerHeight,
    helpOpen,
    welcomeOpen,
    search,
    searchInputRef: searchInputRef as MutableRefObject<HTMLInputElement | null>,
    shellStyle,
    setLeftOpen,
    setRightOpen,
    setDrawerOpen,
    setDrawerTab,
    setInspectorTab,
    setSearch,
    setHelpOpen,
    handleDrawerResizeStart,
    handleDrawerResizeStep,
    handleDrawerResizeTo,
    handleToggleLeft,
    handleToggleRight,
    handleToggleDrawer,
    handleCloseDrawer,
    handleToggleHelp,
    handleCloseHelp,
    handleClearSearch,
    closeWelcome,
    handleWelcomeFocusSearch,
    handleWelcomeOpenMethodology,
    handleWelcomeOpenShortcuts,
  };
}
