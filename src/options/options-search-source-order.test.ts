import { afterEach, describe, expect, it } from 'vitest';
import * as ORDER from '../domain/search/search-source-order';
import type { SearchSourceOrder } from '../domain/search/search-source-order';
import { createSearchSourceOrderController } from './options-search-source-order';

const controllers: Array<ReturnType<typeof createSearchSourceOrderController>> = [];

afterEach(() => {
  controllers.splice(0).forEach((controller) => controller.destroy());
});

describe('Options search source order', () => {
  it('restores the browser content order as one move undo steps back over', async () => {
    const writes: SearchSourceOrder[] = [];
    const controller = createSearchSourceOrderController({
      document: null,
      read: () => ORDER.withLocal(ORDER.normalizeOrder(null), ['history', 'topSite', 'bookmark']),
      write: (value) => { writes.push(value); }
    });
    controllers.push(controller);
    await controller.load();
    expect(controller.isLocalDefault()).toBe(false);

    await controller.resetLocal();
    expect(controller.isLocalDefault()).toBe(true);
    expect(controller.getOrder().local).toEqual(['topSite', 'bookmark', 'history']);
    expect(writes).toHaveLength(1);

    // Nothing to do when the usual order is already there.
    await controller.resetLocal();
    expect(writes).toHaveLength(1);

    expect(controller.undo()).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(controller.getOrder().local).toEqual(['history', 'topSite', 'bookmark']);
    expect(controller.isLocalDefault()).toBe(false);
  });
});
