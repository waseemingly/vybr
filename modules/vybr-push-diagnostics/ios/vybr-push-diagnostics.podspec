require 'json'

package = JSON.parse(File.read(File.join(__dir__, '..', 'package.json')))

Pod::Spec.new do |s|
  s.name         = 'vybr-push-diagnostics'
  s.version      = package['version']
  s.summary      = 'iOS push diagnostics module for runtime APNs checks.'
  s.description  = 'Reads iOS APNs entitlement and notification registration state for debugging push setup.'
  s.license      = { type: 'MIT' }
  s.author       = { 'vybr' => 'support@vybr.app' }
  s.homepage     = 'https://vybr.app'
  s.platforms    = { ios: '15.1' }
  s.source       = { path: '.' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'
  s.source_files = '**/*.{h,m,swift}'
end

