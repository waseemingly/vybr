import ExpoModulesCore
import UIKit
import UserNotifications

public class PushDiagnosticsModule: Module {
  public func definition() -> ModuleDefinition {
    Name("PushDiagnostics")

    Function("getApsEnvironment") { () -> String? in
      // `SecTask*` entitlement APIs are not available/reliable in all iOS build contexts.
      // Keep this callable for diagnostics flow; runtime still exposes notification state
      // via `getNotificationState`, which is the critical APNs signal.
      return nil
    }

    AsyncFunction("getNotificationState") { (promise: Promise) in
      let isRegistered = UIApplication.shared.isRegisteredForRemoteNotifications

      UNUserNotificationCenter.current().getNotificationSettings { settings in
        let payload: [String: Any] = [
          "isRegisteredForRemoteNotifications": isRegistered,
          "authorizationStatus": Self.authorizationStatusString(settings.authorizationStatus),
          "alertSetting": Self.settingString(settings.alertSetting),
          "badgeSetting": Self.settingString(settings.badgeSetting),
          "soundSetting": Self.settingString(settings.soundSetting),
          "notificationCenterSetting": Self.settingString(settings.notificationCenterSetting),
          "lockScreenSetting": Self.settingString(settings.lockScreenSetting),
          "carPlaySetting": Self.settingString(settings.carPlaySetting),
          "timeSensitiveSetting": Self.settingString(settings.timeSensitiveSetting),
          "criticalAlertSetting": Self.settingString(settings.criticalAlertSetting),
          "scheduledDeliverySetting": Self.settingString(settings.scheduledDeliverySetting),
          "showPreviewsSetting": Self.showPreviewsString(settings.showPreviewsSetting)
        ]
        promise.resolve(payload)
      }
    }
  }

  private static func authorizationStatusString(_ status: UNAuthorizationStatus) -> String {
    switch status {
    case .notDetermined: return "notDetermined"
    case .denied: return "denied"
    case .authorized: return "authorized"
    case .provisional: return "provisional"
    case .ephemeral: return "ephemeral"
    @unknown default: return "unknown"
    }
  }

  private static func settingString(_ setting: UNNotificationSetting) -> String {
    switch setting {
    case .notSupported: return "notSupported"
    case .disabled: return "disabled"
    case .enabled: return "enabled"
    @unknown default: return "unknown"
    }
  }

  private static func showPreviewsString(_ setting: UNShowPreviewsSetting) -> String {
    switch setting {
    case .always: return "always"
    case .whenAuthenticated: return "whenAuthenticated"
    case .never: return "never"
    @unknown default: return "unknown"
    }
  }
}

