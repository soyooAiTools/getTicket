export type CheckoutParams = {
  quantity: number;
  ticketType: 'E_TICKET' | 'PAPER_TICKET';
  tierId: string;
  viewerIds: string[];
};

export function parseCheckoutParams(
  params: Record<string, string | undefined>,
): CheckoutParams | null {
  const tierId = params.tierId?.trim() ?? '';
  const viewerIds = (params.viewerIds ?? '')
    .split(',')
    .map((viewerId) => viewerId.trim())
    .filter(Boolean);

  if (!tierId || viewerIds.length === 0) {
    return null;
  }

  return {
    quantity: viewerIds.length,
    ticketType: params.ticketType === 'PAPER_TICKET' ? 'PAPER_TICKET' : 'E_TICKET',
    tierId,
    viewerIds,
  };
}
