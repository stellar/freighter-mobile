Pod::Spec.new do |s|
  s.name         = "ThemePreference"
  s.version      = "1.0.0"
  s.summary      = "Native storage for the theme preference"
  s.description  = "A React Native module that stores the Light/Dark/System choice natively so it applies before the splash is drawn"
  s.homepage     = "https://github.com/stellar/freighter-mobile"
  s.license      = "MIT"
  s.author       = { "Stellar Development Foundation" => "hello@stellar.org" }
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/stellar/freighter-mobile.git" }
  s.source_files = "ThemePreference.{swift,m}"
  s.dependency "React-Core"
end
