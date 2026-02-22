export type ServiceCardConfig = {
  id: string;
  component?: string;
  title: string;
  description: string;
  path: string;
  ctaLabel: string;
  offlineEnabled: boolean;
  isActive?: boolean;
  authRequired?: boolean;
  categoryId?: string;
  keywords?: string[];
  detailedDescription?: string;
  advancedOptionsEnabled?: boolean;
};

type ActiveFlag = {
  isActive?: boolean;
};

export function isCardActive(card: ActiveFlag) {
  return card?.isActive !== false;
}

export function getActiveServiceCards(cards: ServiceCardConfig[]) {
  return cards.filter(isCardActive);
}

export function getServiceCardsWithComponent(cards: ServiceCardConfig[]) {
  return cards.filter(
    (card): card is ServiceCardConfig & { component: string } =>
      typeof card.component === "string" && card.component.trim().length > 0,
  );
}

export function findServiceCardByPath(
  cards: ServiceCardConfig[],
  path: string,
) {
  return cards.find((card) => card.path === path);
}

export function getServiceCardsByCategory(
  cards: ServiceCardConfig[],
  categoryId: string,
) {
  if (categoryId === "all") return cards;
  return cards.filter((card) => card.categoryId === categoryId);
}

export function getOfflineServiceCards(cards: ServiceCardConfig[]) {
  return cards.filter((card) => card.offlineEnabled);
}
