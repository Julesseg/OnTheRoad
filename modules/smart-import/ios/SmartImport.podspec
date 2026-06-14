Pod::Spec.new do |s|
  s.name           = 'SmartImport'
  s.version        = '1.0.0'
  s.summary        = 'On-device Foundation Models trip-draft generation for Smart Import'
  s.description    = 'Structures a pasted planning document into a draft trip with guided generation, on-device.'
  s.author         = ''
  s.homepage       = 'https://docs.expo.dev/modules/'
  s.platforms      = { :ios => '26.0' }
  s.source         = { git: '' }
  s.static_framework = true

  s.dependency 'ExpoModulesCore'

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = '**/*.{h,m,mm,swift,hpp,cpp}'
end
