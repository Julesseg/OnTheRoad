Pod::Spec.new do |s|
  s.name           = 'MKDirections'
  s.version        = '1.0.0'
  s.summary        = 'On-device MapKit driving directions for the trip route'
  s.description    = 'Wraps MKDirections (driving) to return one leg of the trip route as road-following coordinates, on-device with no API key or external host.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '16.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
