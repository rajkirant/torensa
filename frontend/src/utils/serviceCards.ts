export type Faq = {
  q: string;
  a: string;
};

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
  howTo?: string[];
  faqs?: Faq[];
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
  const normalize = (value: string) => {
    const trimmed = (value || "").trim();
    if (trimmed.length > 1 && trimmed.endsWith("/")) {
      return trimmed.slice(0, -1);
    }
    return trimmed;
  };

  const target = normalize(path);
  if (!target) return undefined;

  const exact = cards.find((card) => normalize(card.path) === target);
  if (exact) return exact;

  return cards.find((card) => target.endsWith(normalize(card.path)));
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
