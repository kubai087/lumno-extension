// The notices and feature hints the page shows: the update, graphics
// acceleration and engagement notices, and the Help Center and WebDAV hints.
// Each is null until the part that makes it mounts it.
import type { EngagementNoticeController } from '../shared/engagement-notice';
import type { GraphicsNoticeController } from '../shared/graphics-acceleration-notice';
import type { FeatureHintController } from '../shared/ui/feature-hint-catalog';
import type { UpdateNoticeController } from '../shared/update-notice';

class PageNoticeControllers {
  private updateNotice: UpdateNoticeController | null = null;
  private graphicsNotice: GraphicsNoticeController | null = null;
  private engagementNotice: EngagementNoticeController | null = null;
  private helpCenterHint: FeatureHintController | null = null;
  private webdavHintController: FeatureHintController | null = null;

  get update(): UpdateNoticeController | null {
    return this.updateNotice;
  }

  get graphics(): GraphicsNoticeController | null {
    return this.graphicsNotice;
  }

  get engagement(): EngagementNoticeController | null {
    return this.engagementNotice;
  }

  get helpCenterAskHint(): FeatureHintController | null {
    return this.helpCenterHint;
  }

  get webdavHint(): FeatureHintController | null {
    return this.webdavHintController;
  }

  mountUpdate(controller: UpdateNoticeController | null): void {
    this.updateNotice = controller;
  }

  mountGraphics(controller: GraphicsNoticeController | null): void {
    this.graphicsNotice = controller;
  }

  mountEngagement(controller: EngagementNoticeController | null): void {
    this.engagementNotice = controller;
  }

  mountHelpCenterAskHint(controller: FeatureHintController | null): void {
    this.helpCenterHint = controller;
  }

  mountWebdavHint(controller: FeatureHintController | null): void {
    this.webdavHintController = controller;
  }

  // Draws every mounted notice and hint in the page's current language.
  updateLanguage(): void {
    const all = [this.updateNotice, this.graphicsNotice, this.engagementNotice, this.webdavHintController, this.helpCenterHint];
    for (const controller of all) {
      if (controller) {
        controller.updateLanguage();
      }
    }
  }
}

export { PageNoticeControllers };
