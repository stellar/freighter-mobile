Pod::Spec.new do |s|
  s.name         = "PrivacyShield"
  s.version      = "1.0.0"
  s.summary      = "Privacy shield control for React Native"
  s.description  = "A React Native module that lets JS dismiss the native privacy shield once the auto-lock decision has finished"
  s.homepage     = "https://github.com/stellar/freighter-mobile"
  s.license      = "MIT"
  s.author       = { "Stellar Development Foundation" => "hello@stellar.org" }
  s.platforms    = { :ios => "11.0" }
  s.source       = { :git => "https://github.com/stellar/freighter-mobile.git" }
  s.source_files = "PrivacyShield.{swift,m}"
  s.dependency "React-Core"
end
