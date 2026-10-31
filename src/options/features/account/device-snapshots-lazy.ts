// The device snapshot behind settings files, loaded with the first export
// or import: it brings the image checks and the wallpaper store, which the
// rest of the page never needs.
import type { DeviceSnapshots } from '../../../platform/device-snapshot';
import type { ProviderStorageRuntime } from '../../../platform/settings-storage';

let loading: Promise<DeviceSnapshots> | null = null;

function loadDeviceSnapshots(provider: ProviderStorageRuntime): Promise<DeviceSnapshots> {
  loading ||= Promise.all([
    import('../../../platform/device-snapshot'),
    import('../../../shared/wallpaper-local-store')
  ]).then(([snapshots, wallpapers]) => snapshots.createDeviceSnapshots({
    chromeApi: chrome,
    provider,
    wallpaperStore: wallpapers.createWallpaperLocalStore({ windowObj: window, onChange() {} }),
    crypto: window.crypto
  }));
  return loading;
}

export { loadDeviceSnapshots };
