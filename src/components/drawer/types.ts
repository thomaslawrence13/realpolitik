export type DrawerTab = 'index' | 'movers' | 'methodology' | 'analysis' | 'events' | 'history';

export type EventFeedItem = {
  title: string;
  detail: string;
  tone: 'low' | 'medium' | 'high';
};
