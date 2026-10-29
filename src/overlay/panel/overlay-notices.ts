// The notices shown on the overlay this session: the update notice, the
// graphics acceleration notice and the engagement notice. The panel makes
// them once it mounts; the session removes them when it closes.
import type { EngagementNoticeController } from '../../shared/engagement-notice';
import type { GraphicsNoticeController } from '../../shared/graphics-acceleration-notice';
import type { UpdateNoticeController } from '../../shared/update-notice';

interface NoticeControllers {
  update: UpdateNoticeController | null;
  graphics: GraphicsNoticeController | null;
  engagement: EngagementNoticeController | null;
}

class OverlayNotices {
  private controllers: NoticeControllers = { update: null, graphics: null, engagement: null };

  get update(): UpdateNoticeController | null {
    return this.controllers.update;
  }

  get graphics(): GraphicsNoticeController | null {
    return this.controllers.graphics;
  }

  get engagement(): EngagementNoticeController | null {
    return this.controllers.engagement;
  }

  setUpdate(controller: UpdateNoticeController | null): void {
    this.controllers.update = controller;
  }

  setGraphics(controller: GraphicsNoticeController | null): void {
    this.controllers.graphics = controller;
  }

  setEngagement(controller: EngagementNoticeController | null): void {
    this.controllers.engagement = controller;
  }

  updateLanguage(): void {
    [this.controllers.update, this.controllers.graphics, this.controllers.engagement].forEach((controller) => {
      if (controller && typeof controller.updateLanguage === 'function') {
        controller.updateLanguage();
      }
    });
  }

  // A query typed counts as a use the engagement notice waits for.
  recordMeaningfulUse(): void {
    const engagement = this.controllers.engagement;
    if (engagement && typeof engagement.recordMeaningfulUse === 'function') {
      engagement.recordMeaningfulUse();
    }
  }

  destroy(): void {
    [this.controllers.update, this.controllers.graphics, this.controllers.engagement].forEach((controller) => {
      if (!controller || typeof controller.destroy !== 'function') {
        return;
      }
      if (controller.element && controller.element.parentNode) {
        controller.element.parentNode.removeChild(controller.element);
      }
      controller.destroy();
    });
    this.controllers = { update: null, graphics: null, engagement: null };
  }
}

export { OverlayNotices };
