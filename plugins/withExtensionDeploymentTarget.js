const { withDangerousMod } = require('expo/config-plugins');
const fs = require('fs');
const path = require('path');

/**
 * Bumps every CocoaPods target whose iOS deployment target is below 16.4 up to
 * 16.4, by injecting the loop into the Podfile's existing `post_install` hook.
 *
 * Why this is needed: @bacons/apple-targets ships an `ExtensionStorage` pod that
 * hardcodes `s.platform = :ios, '15.1'` yet depends on `ExpoModulesCore`, whose
 * minimum is iOS 16.4. That pod is linked into the Share Extension target, so it
 * compiles at 15.1 and fails to import the 16.4 module (`xcodebuild` error 65).
 * Neither `expo-build-properties` (`deploymentTarget` only sets the Podfile-level
 * floor) nor React Native's own `post_install` (only raises pods to RN's floor)
 * lifts a pod that declares its own lower platform. This plugin closes that gap.
 *
 * CocoaPods allows a single `post_install` hook, and the Expo/RN template already
 * defines one, so we splice into it rather than appending a second.
 */
const MARKER = '# withExtensionDeploymentTarget: bump pods below 16.4';
const MIN_DEPLOYMENT_TARGET = '16.4';

const BUMP = `
    ${MARKER}
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        current = config.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
        if current && current.to_f < ${MIN_DEPLOYMENT_TARGET}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_DEPLOYMENT_TARGET}'
        end
      end
    end`;

module.exports = function withExtensionDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(
        cfg.modRequest.platformProjectRoot,
        'Podfile'
      );
      let contents = fs.readFileSync(podfilePath, 'utf8');

      if (contents.includes(MARKER)) {
        return cfg;
      }

      // Splice the bump in right after the `react_native_post_install(...)` call
      // that lives inside the template's existing `post_install` block.
      const RN_POST_INSTALL = /(react_native_post_install\([\s\S]*?\n {4}\))/;
      if (!RN_POST_INSTALL.test(contents)) {
        throw new Error(
          'withExtensionDeploymentTarget: could not find react_native_post_install() ' +
            'in the Podfile to anchor the deployment-target bump.'
        );
      }
      contents = contents.replace(RN_POST_INSTALL, `$1\n${BUMP}`);

      fs.writeFileSync(podfilePath, contents);
      return cfg;
    },
  ]);
};
